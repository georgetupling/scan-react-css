import { getMigratedExternalCssRuleFindings } from "../../static-analysis-engine/adapters/current-scanner/runMigratedExternalCssRules.js";
import type { RuleDefinition } from "../types.js";

export const missingExternalCssClassRule: RuleDefinition = {
  ruleId: "missing-external-css-class",
  family: "external-css",
  defaultSeverity: "error",
  run(context) {
    const severity = context.getRuleSeverity("missing-external-css-class", "error");
    if (severity === "off") {
      return [];
    }

    return getMigratedExternalCssRuleFindings(context);
  },
};
