import type { RuleDefinition } from "./types.js";
import { cssModuleRules } from "./css-modules/index.js";
import { definitionAndUsageIntegrityRules } from "./definition-and-usage-integrity/index.js";
import { dynamicAnalysisRules } from "./dynamic-analysis/index.js";
import { externalCssRules } from "./external-css/index.js";
import { optimizationAndMigrationRules } from "./optimization-and-migration/index.js";
import { ownershipAndOrganizationRules } from "./ownership-and-organization/index.js";

export const RULE_DEFINITIONS: RuleDefinition[] = [
  ...definitionAndUsageIntegrityRules,
  ...ownershipAndOrganizationRules,
  ...dynamicAnalysisRules,
  ...cssModuleRules,
  ...externalCssRules,
  ...optimizationAndMigrationRules,
];
