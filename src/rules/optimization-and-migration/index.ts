import type { RuleDefinition } from "../types.js";
import { duplicateCssClassDefinitionRule } from "./duplicateCssClassDefinition.js";
import { emptyCssRuleRule } from "./emptyCssRule.js";
import { redundantCssDeclarationBlockRule } from "./redundantCssDeclarationBlock.js";
import { unusedCompoundSelectorBranchRule } from "./unusedCompoundSelectorBranch.js";
import { utilityClassReplacementRule } from "./utilityClassReplacement.js";

export const optimizationAndMigrationRules: RuleDefinition[] = [
  utilityClassReplacementRule,
  unusedCompoundSelectorBranchRule,
  emptyCssRuleRule,
  redundantCssDeclarationBlockRule,
  duplicateCssClassDefinitionRule,
];
