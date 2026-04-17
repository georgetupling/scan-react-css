import type { RuleDefinition } from "../types.js";
import { missingExternalCssClassRule } from "./missingExternalCssClass.js";

export const externalCssRules: RuleDefinition[] = [missingExternalCssClassRule];
