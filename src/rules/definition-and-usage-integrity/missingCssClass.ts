import type { RuleDefinition } from "../types.js";
import { getMigratedDefinitionAndUsageIntegrityRuleFindings } from "../../static-analysis-engine/adapters/current-scanner/runMigratedDefinitionAndUsageIntegrityRules.js";

export const missingCssClassRule: RuleDefinition = {
  ruleId: "missing-css-class",
  family: "definition-and-usage-integrity",
  defaultSeverity: "warning",
  run(context) {
    const severity = context.getRuleSeverity("missing-css-class", "info");
    if (severity === "off") {
      return [];
    }

    return getMigratedDefinitionAndUsageIntegrityRuleFindings(context, "missing-css-class");
  },
};
