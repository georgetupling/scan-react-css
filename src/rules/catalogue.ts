import { missingCssClassRule } from "./rules/missingCssClass.js";
import { cssClassUnreachableRule } from "./rules/cssClassUnreachable.js";
import { dynamicClassReferenceRule } from "./rules/dynamicClassReference.js";
import { missingCssModuleClassRule } from "./rules/missingCssModuleClass.js";
import { unsupportedSyntaxAffectingAnalysisRule } from "./rules/unsupportedSyntaxAffectingAnalysis.js";
import { unusedCssClassRule } from "./rules/unusedCssClass.js";
import { unusedCssModuleClassRule } from "./rules/unusedCssModuleClass.js";
import type { RuleDefinition, RuleId, RuleSeverity } from "./types.js";

export const RULE_DEFINITIONS: RuleDefinition[] = [
  missingCssClassRule,
  cssClassUnreachableRule,
  unusedCssClassRule,
  missingCssModuleClassRule,
  unusedCssModuleClassRule,
  dynamicClassReferenceRule,
  unsupportedSyntaxAffectingAnalysisRule,
];

export const DEFAULT_RULE_SEVERITIES: Record<RuleId, RuleSeverity> = {
  "missing-css-class": "error",
  "css-class-unreachable": "error",
  "unused-css-class": "warn",
  "missing-css-module-class": "error",
  "unused-css-module-class": "warn",
  "dynamic-class-reference": "info",
  "unsupported-syntax-affecting-analysis": "debug",
};
