import type { RuleDefinition } from "../types.js";
import { componentCssShouldBeGlobalRule } from "./componentCssShouldBeGlobal.js";
import { componentStyleCrossComponentRule } from "./componentStyleCrossComponent.js";
import { globalCssNotGlobalRule } from "./globalCssNotGlobal.js";
import { pageStyleUsedBySingleComponentRule } from "./pageStyleUsedBySingleComponent.js";

export const ownershipAndOrganizationRules: RuleDefinition[] = [
  componentStyleCrossComponentRule,
  globalCssNotGlobalRule,
  pageStyleUsedBySingleComponentRule,
  componentCssShouldBeGlobalRule,
];
