import type { RuleDefinition } from "../types.js";
import {
  getProjectClassDefinitions,
  isCssModuleReference,
  isDefinitionReachable,
} from "../helpers.js";

export const unreachableCssRule: RuleDefinition = {
  ruleId: "unreachable-css",
  family: "definition-and-usage-integrity",
  defaultSeverity: "error",
  run(context) {
    const severity = context.getRuleSeverity("unreachable-css", "error");
    if (severity === "off") {
      return [];
    }

    const findings = [];

    for (const sourceFile of context.model.graph.sourceFiles) {
      for (const reference of sourceFile.classReferences) {
        if (!reference.className || isCssModuleReference(reference.kind)) {
          continue;
        }

        const candidateDefinitions = getProjectClassDefinitions(context.model, reference.className);
        if (candidateDefinitions.length === 0) {
          continue;
        }

        const reachableDefinitions = candidateDefinitions.filter((definition) =>
          isDefinitionReachable(
            context.model,
            sourceFile.path,
            definition.cssFile,
            definition.externalSpecifier,
          ),
        );
        if (reachableDefinitions.length > 0) {
          continue;
        }

        findings.push(
          context.createFinding({
            ruleId: "unreachable-css",
            family: "definition-and-usage-integrity",
            severity,
            confidence: reference.confidence,
            message: `Class "${reference.className}" exists in project CSS, but not in CSS reachable from "${sourceFile.path}".`,
            primaryLocation: {
              filePath: sourceFile.path,
              line: reference.line,
              column: reference.column,
            },
            relatedLocations: candidateDefinitions.map((definition) => ({
              filePath: definition.cssFile,
              line: definition.definition.line,
            })),
            subject: {
              className: reference.className,
              sourceFilePath: sourceFile.path,
            },
            metadata: {
              candidateCssFiles: candidateDefinitions.map((definition) => definition.cssFile),
            },
          }),
        );
      }
    }

    return findings;
  },
};
