import type { RuleDefinition } from "../types.js";
import {
  DYNAMIC_REFERENCE_KINDS,
  getProjectClassDefinitions,
  isCssModuleReference,
  isDefinitionReachable,
} from "../helpers.js";

export const dynamicMissingCssClassRule: RuleDefinition = {
  ruleId: "dynamic-missing-css-class",
  family: "dynamic-analysis",
  defaultSeverity: "debug",
  run(context) {
    const severity = context.getRuleSeverity("dynamic-missing-css-class", "debug");
    if (severity === "off") {
      return [];
    }

    const findings = [];

    for (const sourceFile of context.model.graph.sourceFiles) {
      for (const reference of sourceFile.classReferences) {
        if (isCssModuleReference(reference.kind) || !DYNAMIC_REFERENCE_KINDS.has(reference.kind)) {
          continue;
        }

        const candidateDefinitions = reference.className
          ? getProjectClassDefinitions(context.model, reference.className)
          : [];
        const reachableDefinitions = reference.className
          ? candidateDefinitions.filter((definition) =>
              isDefinitionReachable(
                context.model,
                sourceFile.path,
                definition.cssFile,
                definition.externalSpecifier,
              ),
            )
          : [];

        if (candidateDefinitions.length > 0 || reachableDefinitions.length > 0) {
          continue;
        }

        findings.push(
          context.createFinding({
            ruleId: "dynamic-missing-css-class",
            family: "dynamic-analysis",
            severity,
            confidence: reference.confidence,
            message: reference.className
              ? `Dynamic class "${reference.className}" appears likely to be referenced, but no matching CSS definition could be confirmed.`
              : `A dynamically composed class in "${sourceFile.path}" could not be resolved to a confirmed CSS definition.`,
            primaryLocation: {
              filePath: sourceFile.path,
              line: reference.line,
              column: reference.column,
            },
            subject: reference.className
              ? {
                  className: reference.className,
                  sourceFilePath: sourceFile.path,
                }
              : {
                  sourceFilePath: sourceFile.path,
                },
            metadata: {
              referenceKind: reference.kind,
              sourceExpression: reference.source,
            },
          }),
        );
      }
    }

    return findings;
  },
};
