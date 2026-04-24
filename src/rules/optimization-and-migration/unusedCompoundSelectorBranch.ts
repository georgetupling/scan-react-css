import { getMigratedOptimizationRuleFindings } from "../../static-analysis-engine/adapters/current-scanner/runMigratedOptimizationRules.js";
import type { RuleDefinition } from "../types.js";

export const unusedCompoundSelectorBranchRule: RuleDefinition = {
  ruleId: "unused-compound-selector-branch",
  family: "optimization-and-migration",
  defaultSeverity: "info",
  run(context) {
    const severity = context.getRuleSeverity("unused-compound-selector-branch", "info");
    if (severity === "off") {
      return [];
    }

    return getMigratedOptimizationRuleFindings(context, "unused-compound-selector-branch");
  },
};
