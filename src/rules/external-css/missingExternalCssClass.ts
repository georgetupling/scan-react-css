import type { RuleDefinition } from "../types.js";
import { getDeclaredExternalProviderForClass, isCssModuleReference } from "../helpers.js";
import { isPlainClassDefinition } from "../cssDefinitionUtils.js";
import { isDefinitionReachable } from "../reachability.js";

export const missingExternalCssClassRule: RuleDefinition = {
  ruleId: "missing-external-css-class",
  family: "external-css",
  defaultSeverity: "error",
  run(context) {
    const severity = context.getRuleSeverity("missing-external-css-class", "error");
    if (severity === "off") {
      return [];
    }

    const findings = [];

    for (const sourceFile of context.model.graph.sourceFiles) {
      const reachability = context.model.reachability.get(sourceFile.path);
      if (!reachability || reachability.externalCss.size === 0) {
        continue;
      }

      for (const reference of sourceFile.classReferences) {
        if (!reference.className || isCssModuleReference(reference.kind)) {
          continue;
        }

        const definitions = (
          context.model.indexes.classDefinitionsByName.get(reference.className) ?? []
        ).filter((definition) => isPlainClassDefinition(definition.definition));
        const reachableExternalDefinitions = definitions.filter(
          (definition) =>
            definition.externalSpecifier &&
            isDefinitionReachable(
              context.model,
              sourceFile.path,
              definition.cssFile,
              definition.externalSpecifier,
            ),
        );

        if (reachableExternalDefinitions.length > 0) {
          continue;
        }

        const reachableProjectDefinitions = definitions.filter(
          (definition) =>
            !definition.externalSpecifier &&
            isDefinitionReachable(context.model, sourceFile.path, definition.cssFile),
        );

        if (reachableProjectDefinitions.length > 0) {
          continue;
        }

        const declaredExternalProvider = getDeclaredExternalProviderForClass(
          context.model,
          reference.className,
        );
        if (declaredExternalProvider) {
          continue;
        }

        findings.push(
          context.createFinding({
            ruleId: "missing-external-css-class",
            family: "external-css",
            severity,
            confidence: reference.confidence,
            message: `Class "${reference.className}" appears intended to come from imported external CSS, but no matching imported external stylesheet definition was found.`,
            primaryLocation: {
              filePath: sourceFile.path,
              line: reference.line,
              column: reference.column,
            },
            relatedLocations: [...reachability.externalCss]
              .sort((left, right) => left.localeCompare(right))
              .map((specifier) => ({ filePath: specifier })),
            subject: {
              className: reference.className,
              sourceFilePath: sourceFile.path,
            },
            metadata: {
              externalCssSpecifiers: [...reachability.externalCss].sort((left, right) =>
                left.localeCompare(right),
              ),
              referenceKind: reference.kind,
            },
          }),
        );
      }
    }

    return findings;
  },
};
