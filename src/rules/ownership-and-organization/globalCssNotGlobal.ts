import type { RuleDefinition } from "../types.js";
import { getUsingSourceFiles } from "../helpers.js";

export const globalCssNotGlobalRule: RuleDefinition = {
  ruleId: "global-css-not-global",
  family: "ownership-and-organization",
  defaultSeverity: "info",
  run(context) {
    const severity = context.getRuleSeverity("global-css-not-global", "info");
    if (severity === "off") {
      return [];
    }

    const findings = [];

    for (const cssFile of context.model.graph.cssFiles) {
      if (cssFile.ownership !== "global") {
        continue;
      }

      const usingSources = [...getUsingSourceFiles(context.model, cssFile)].sort((left, right) =>
        left.localeCompare(right),
      );

      if (usingSources.length > 1) {
        continue;
      }

      findings.push(
        context.createFinding({
          ruleId: "global-css-not-global",
          family: "ownership-and-organization",
          severity,
          confidence: "high",
          message: `Global CSS "${cssFile.path}" is only used in a narrow scope and may not belong in the global tier.`,
          primaryLocation: {
            filePath: cssFile.path,
          },
          relatedLocations: usingSources.map((sourceFile) => ({
            filePath: sourceFile,
          })),
          subject: {
            cssFilePath: cssFile.path,
          },
          metadata: {
            usingSources,
          },
        }),
      );
    }

    return findings;
  },
};
