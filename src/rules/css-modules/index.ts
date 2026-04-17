import type { RuleDefinition } from "../types.js";
import { missingCssModuleClassRule } from "./missingCssModuleClass.js";
import { unusedCssModuleClassRule } from "./unusedCssModuleClass.js";

export const cssModuleRules: RuleDefinition[] = [
  missingCssModuleClassRule,
  unusedCssModuleClassRule,
];
