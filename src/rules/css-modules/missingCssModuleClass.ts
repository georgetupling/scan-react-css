import type { RuleDefinition } from "../types.js";

export const missingCssModuleClassRule: RuleDefinition = {
  ruleId: "missing-css-module-class",
  family: "css-modules",
  defaultSeverity: "error",
  run(context) {
    const severity = context.getRuleSeverity("missing-css-module-class", "error");
    if (severity === "off") {
      return [];
    }

    const findings = [];

    for (const sourceFile of context.model.graph.sourceFiles) {
      for (const reference of sourceFile.classReferences) {
        if (
          !reference.className ||
          (reference.kind !== "css-module-property" &&
            reference.kind !== "css-module-dynamic-property")
        ) {
          continue;
        }

        const moduleLocalName = reference.metadata?.moduleLocalName;
        if (typeof moduleLocalName !== "string") {
          continue;
        }

        const cssModuleImport = sourceFile.cssModuleImports.find(
          (entry) => entry.localName === moduleLocalName,
        );
        if (!cssModuleImport?.resolvedPath) {
          continue;
        }

        const cssFile = context.model.indexes.cssFileByPath.get(cssModuleImport.resolvedPath);
        if (!cssFile) {
          continue;
        }

        const classExists = cssFile.classDefinitions.some(
          (definition) => definition.className === reference.className,
        );
        if (classExists) {
          continue;
        }

        findings.push(
          context.createFinding({
            ruleId: "missing-css-module-class",
            family: "css-modules",
            severity,
            confidence: reference.confidence,
            message: `CSS Module reference "${moduleLocalName}.${reference.className}" does not exist in "${cssFile.path}".`,
            primaryLocation: {
              filePath: sourceFile.path,
              line: reference.line,
              column: reference.column,
            },
            relatedLocations: [
              {
                filePath: cssFile.path,
              },
            ],
            subject: {
              className: reference.className,
              cssFilePath: cssFile.path,
              sourceFilePath: sourceFile.path,
            },
            metadata: {
              moduleLocalName,
              cssModulePath: cssFile.path,
            },
          }),
        );
      }
    }

    return findings;
  },
};
