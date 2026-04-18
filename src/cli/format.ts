import type { ResolvedScanReactCssConfig } from "../config/types.js";
import type { Finding, ScanResult } from "../runtime/types.js";

export type OutputVerbosity = "low" | "medium" | "high";

export function formatJsonOutput(result: ScanResult, printConfig: boolean): string {
  const payload: Record<string, unknown> = {
    summary: result.summary,
    findings: result.findings,
  };

  if ((result.operationalWarnings?.length ?? 0) > 0) {
    payload.operationalWarnings = result.operationalWarnings;
  }

  if (printConfig) {
    payload.config = result.config;
  }

  return JSON.stringify(payload, null, 2);
}

export function formatHumanReadableOutput(input: {
  result: ScanResult;
  verbosity: OutputVerbosity;
  scanTarget: string;
  focusPath?: string;
  printConfig: boolean;
}): string {
  const filteredFindings = input.result.findings;
  const lines: string[] = [];

  lines.push(`Scan target: ${input.scanTarget}`);
  if (input.focusPath) {
    lines.push(`Focus path: ${input.focusPath}`);
  }
  if (input.result.configSource) {
    const sourceLabel = input.result.configSource.filePath
      ? `${input.result.configSource.kind} (${input.result.configSource.filePath})`
      : input.result.configSource.kind;
    lines.push(`Config source: ${sourceLabel}`);
  }
  lines.push(
    `Summary: ${input.result.summary.findingCount} findings (${input.result.summary.errorCount} error, ${input.result.summary.warningCount} warning, ${input.result.summary.infoCount} info${
      input.result.summary.debugCount > 0 ? `, ${input.result.summary.debugCount} debug` : ""
    }) across ${input.result.summary.fileCount} files`,
  );

  if (filteredFindings.length === 0) {
    lines.push("Findings: none");
  } else {
    lines.push("Findings:");
    const groupedFindings = groupFindingsBySubject(filteredFindings);

    for (const group of groupedFindings) {
      if (group.label) {
        lines.push(`- ${group.label}`);
      }

      for (const finding of group.findings) {
        const prefix = group.label ? "  " : "- ";
        const location = finding.primaryLocation?.filePath
          ? ` @ ${finding.primaryLocation.filePath}`
          : "";
        lines.push(
          `${prefix}[${finding.severity}/${finding.confidence}] ${finding.ruleId}${location}: ${finding.message}`,
        );

        if (input.verbosity === "high" && finding.relatedLocations.length > 0) {
          for (const relatedLocation of finding.relatedLocations) {
            lines.push(`    related: ${relatedLocation.filePath}`);
          }
        }

        if (input.verbosity === "high") {
          const metadataEntries = Object.entries(finding.metadata);
          if (metadataEntries.length > 0) {
            lines.push(`    metadata: ${JSON.stringify(finding.metadata)}`);
          }
        }
      }
    }
  }

  if (input.printConfig) {
    lines.push("Config:");
    lines.push(JSON.stringify(resultConfigForPrint(input.result.config), null, 2));
  }

  return lines.join("\n");
}

function groupFindingsBySubject(
  findings: Finding[],
): Array<{ label?: string; findings: Finding[] }> {
  const groups = new Map<string, Finding[]>();
  const ungrouped: Finding[] = [];

  for (const finding of findings) {
    const label = finding.subject?.className ?? finding.subject?.cssFilePath ?? undefined;

    if (!label) {
      ungrouped.push(finding);
      continue;
    }

    const groupFindings = groups.get(label) ?? [];
    groupFindings.push(finding);
    groups.set(label, groupFindings);
  }

  const grouped: Array<{ label?: string; findings: Finding[] }> = [...groups.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([label, groupFindings]) => ({
      label,
      findings: groupFindings,
    }));

  if (ungrouped.length > 0) {
    grouped.push({
      findings: ungrouped,
    });
  }

  return grouped;
}

function resultConfigForPrint(config: ResolvedScanReactCssConfig) {
  return config;
}
