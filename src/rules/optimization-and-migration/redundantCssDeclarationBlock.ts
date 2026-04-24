import { getMigratedOptimizationRuleFindings } from "../../static-analysis-engine/adapters/current-scanner/runMigratedOptimizationRules.js";
import type { RuleDefinition } from "../types.js";

export const redundantCssDeclarationBlockRule: RuleDefinition = {
  ruleId: "redundant-css-declaration-block",
  family: "optimization-and-migration",
  defaultSeverity: "info",
  run(context) {
    const severity = context.getRuleSeverity("redundant-css-declaration-block", "info");
    if (severity === "off") {
      return [];
    }

    return getMigratedOptimizationRuleFindings(context, "redundant-css-declaration-block");
  },
};
