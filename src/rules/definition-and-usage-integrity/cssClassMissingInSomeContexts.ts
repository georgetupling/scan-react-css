import type { RuleDefinition } from "../types.js";
import { getMigratedDefinitionAndUsageIntegrityRuleFindings } from "../../static-analysis-engine/adapters/current-scanner/runMigratedDefinitionAndUsageIntegrityRules.js";

export const cssClassMissingInSomeContextsRule: RuleDefinition = {
  ruleId: "css-class-missing-in-some-contexts",
  family: "definition-and-usage-integrity",
  defaultSeverity: "info",
  run(context) {
    const severity = context.getRuleSeverity("css-class-missing-in-some-contexts", "info");
    if (severity === "off") {
      return [];
    }

    return getMigratedDefinitionAndUsageIntegrityRuleFindings(
      context,
      "css-class-missing-in-some-contexts",
    );
  },
};
