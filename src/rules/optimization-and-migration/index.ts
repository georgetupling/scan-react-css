import type { RuleDefinition } from "../types.js";
import { duplicateCssClassDefinitionRule } from "./duplicateCssClassDefinition.js";
import { emptyCssRuleRule } from "./emptyCssRule.js";
import { redundantCssDeclarationBlockRule } from "./redundantCssDeclarationBlock.js";
import { utilityClassReplacementRule } from "./utilityClassReplacement.js";

export const optimizationAndMigrationRules: RuleDefinition[] = [
  utilityClassReplacementRule,
  emptyCssRuleRule,
  redundantCssDeclarationBlockRule,
  duplicateCssClassDefinitionRule,
];
