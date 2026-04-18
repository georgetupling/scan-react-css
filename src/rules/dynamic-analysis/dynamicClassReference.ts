import type { RuleDefinition } from "../types.js";
import { DYNAMIC_REFERENCE_KINDS, getDeclaredExternalProviderForClass } from "../helpers.js";

export const dynamicClassReferenceRule: RuleDefinition = {
  ruleId: "dynamic-class-reference",
  family: "dynamic-analysis",
  defaultSeverity: "warning",
  run(context) {
    const severity = context.getRuleSeverity("dynamic-class-reference", "warning");
    if (severity === "off") {
      return [];
    }

    const findings = [];

    for (const sourceFile of context.model.graph.sourceFiles) {
      for (const reference of sourceFile.classReferences) {
        if (reference.confidence === "high" && !DYNAMIC_REFERENCE_KINDS.has(reference.kind)) {
          continue;
        }

        if (
          reference.className &&
          getDeclaredExternalProviderForClass(context.model, reference.className)
        ) {
          continue;
        }

        findings.push(
          context.createFinding({
            ruleId: "dynamic-class-reference",
            family: "dynamic-analysis",
            severity,
            confidence: reference.confidence,
            message: `Dynamic class composition in "${sourceFile.path}" could not be resolved with full confidence.`,
            primaryLocation: {
              filePath: sourceFile.path,
              line: reference.line,
              column: reference.column,
            },
            subject: {
              className: reference.className,
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
