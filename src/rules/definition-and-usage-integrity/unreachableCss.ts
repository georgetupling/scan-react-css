import type { RuleDefinition } from "../types.js";
import { getMigratedDefinitionAndUsageIntegrityRuleFindings } from "../../static-analysis-engine/adapters/current-scanner/runMigratedDefinitionAndUsageIntegrityRules.js";

export const unreachableCssRule: RuleDefinition = {
  ruleId: "unreachable-css",
  family: "definition-and-usage-integrity",
  defaultSeverity: "warning",
  run(context) {
    const severity = context.getRuleSeverity("unreachable-css", "info");
    if (severity === "off") {
      return [];
    }

    return getMigratedDefinitionAndUsageIntegrityRuleFindings(context, "unreachable-css");
  },
};
