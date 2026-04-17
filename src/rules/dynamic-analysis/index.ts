import type { RuleDefinition } from "../types.js";
import { dynamicClassReferenceRule } from "./dynamicClassReference.js";
import { dynamicMissingCssClassRule } from "./dynamicMissingCssClass.js";

export const dynamicAnalysisRules: RuleDefinition[] = [
  dynamicClassReferenceRule,
  dynamicMissingCssClassRule,
];
