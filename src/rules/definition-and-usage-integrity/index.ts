import type { RuleDefinition } from "../types.js";
import { missingCssClassRule } from "./missingCssClass.js";
import { unreachableCssRule } from "./unreachableCss.js";
import { unusedCssClassRule } from "./unusedCssClass.js";

export const definitionAndUsageIntegrityRules: RuleDefinition[] = [
  missingCssClassRule,
  unreachableCssRule,
  unusedCssClassRule,
];
