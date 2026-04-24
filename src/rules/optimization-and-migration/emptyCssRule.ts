import { getMigratedOptimizationRuleFindings } from "../../static-analysis-engine/adapters/current-scanner/runMigratedOptimizationRules.js";
import type { RuleDefinition } from "../types.js";

export const emptyCssRuleRule: RuleDefinition = {
  ruleId: "empty-css-rule",
  family: "optimization-and-migration",
  defaultSeverity: "warning",
  run(context) {
    const severity = context.getRuleSeverity("empty-css-rule", "info");
    if (severity === "off") {
      return [];
    }

    return getMigratedOptimizationRuleFindings(context, "empty-css-rule");
  },
};
