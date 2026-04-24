import { getMigratedOptimizationRuleFindings } from "../../static-analysis-engine/adapters/current-scanner/runMigratedOptimizationRules.js";
import type { RuleDefinition } from "../types.js";

export const duplicateCssClassDefinitionRule: RuleDefinition = {
  ruleId: "duplicate-css-class-definition",
  family: "optimization-and-migration",
  defaultSeverity: "warning",
  run(context) {
    const severity = context.getRuleSeverity("duplicate-css-class-definition", "warning");
    if (severity === "off") {
      return [];
    }

    return getMigratedOptimizationRuleFindings(context, "duplicate-css-class-definition");
  },
};
