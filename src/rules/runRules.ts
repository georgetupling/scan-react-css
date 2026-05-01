import { DEFAULT_RULE_SEVERITIES, RULE_DEFINITIONS } from "./catalogue.js";
import type { RuleContext, RuleEngineResult } from "./types.js";

export function runRules(context: RuleContext): RuleEngineResult {
  const profileEnabled = process.env.SCAN_REACT_CSS_PROFILE_RUN_RULES === "1";
  return {
    findings: RULE_DEFINITIONS.flatMap((rule) => {
      const configuredSeverity = context.config.rules[rule.id];
      if (configuredSeverity === "off") {
        return [];
      }

      const severity = configuredSeverity ?? DEFAULT_RULE_SEVERITIES[rule.id];
      const startedAt = performance.now();
      const rawFindings = rule.run(context);
      if (profileEnabled) {
        const elapsedMs = performance.now() - startedAt;
        console.error(
          `[profile:run-rules] ${rule.id}: ${elapsedMs.toFixed(1)}ms findings=${rawFindings.length}`,
        );
      }
      return rawFindings.map((finding) => ({
        ...finding,
        severity,
        traces: context.includeTraces === false ? [] : finding.traces,
      }));
    }).sort((left, right) => left.id.localeCompare(right.id)),
  };
}
