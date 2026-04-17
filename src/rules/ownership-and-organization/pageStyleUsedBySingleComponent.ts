import type { RuleDefinition } from "../types.js";
import { getUsingSourceFiles } from "../helpers.js";

export const pageStyleUsedBySingleComponentRule: RuleDefinition = {
  ruleId: "page-style-used-by-single-component",
  family: "ownership-and-organization",
  defaultSeverity: "info",
  run(context) {
    const severity = context.getRuleSeverity("page-style-used-by-single-component", "info");
    if (severity === "off") {
      return [];
    }

    const findings = [];

    for (const cssFile of context.model.graph.cssFiles) {
      if (cssFile.ownership !== "page") {
        continue;
      }

      const usingSources = [...getUsingSourceFiles(context.model, cssFile)].sort((left, right) =>
        left.localeCompare(right),
      );
      if (usingSources.length !== 1) {
        continue;
      }

      findings.push(
        context.createFinding({
          ruleId: "page-style-used-by-single-component",
          family: "ownership-and-organization",
          severity,
          confidence: "medium",
          message: `Page-level CSS "${cssFile.path}" is effectively serving a single source file and may belong closer to that component.`,
          primaryLocation: {
            filePath: cssFile.path,
          },
          relatedLocations: usingSources.map((sourceFile) => ({ filePath: sourceFile })),
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
