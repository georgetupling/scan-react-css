#!/usr/bin/env node
import { scanProject } from "./project/index.js";
import type { AnalysisTrace } from "./static-analysis-engine/index.js";

type CliArgs = {
  rootDir?: string;
  configPath?: string;
  json: boolean;
  trace: boolean;
  help: boolean;
};

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printHelp();
  process.exit(0);
}

const result = await scanProject({
  rootDir: args.rootDir,
  configPath: args.configPath,
});

if (args.json) {
  console.log(
    JSON.stringify(
      {
        rootDir: result.rootDir,
        diagnostics: result.diagnostics,
        findings: result.findings,
        config: {
          source: result.config.source,
          failOnSeverity: result.config.failOnSeverity,
          rules: result.config.rules,
        },
        summary: {
          sourceFileCount: result.files.sourceFiles.length,
          cssFileCount: result.files.cssFiles.length,
          findingCount: result.findings.length,
          failed: result.failed,
          classReferenceCount: result.analysis.entities.classReferences.length,
          classDefinitionCount: result.analysis.entities.classDefinitions.length,
          selectorQueryCount: result.analysis.entities.selectorQueries.length,
        },
      },
      null,
      2,
    ),
  );
} else {
  console.log(`scan-react-css reboot scan`);
  console.log(`Root: ${result.rootDir}`);
  console.log(`Source files: ${result.files.sourceFiles.length}`);
  console.log(`CSS files: ${result.files.cssFiles.length}`);
  console.log(`Findings: ${result.findings.length}`);
  console.log(`Failed: ${result.failed ? "yes" : "no"}`);
  console.log(`Fail on severity: ${result.config.failOnSeverity}`);
  console.log(`Class references: ${result.analysis.entities.classReferences.length}`);
  console.log(`Class definitions: ${result.analysis.entities.classDefinitions.length}`);
  console.log(`Selector queries: ${result.analysis.entities.selectorQueries.length}`);

  for (const diagnostic of result.diagnostics) {
    console.log(`[${diagnostic.severity}] ${diagnostic.code}: ${diagnostic.message}`);
  }

  for (const finding of result.findings) {
    const location = finding.location
      ? ` (${finding.location.filePath}:${finding.location.startLine})`
      : "";
    console.log(`[${finding.severity}] ${finding.ruleId}: ${finding.message}${location}`);
    if (args.trace) {
      for (const trace of finding.traces) {
        printTrace(trace, "  ");
      }
    }
  }
}

process.exit(result.failed ? 1 : 0);

function parseArgs(rawArgs: string[]): CliArgs {
  const args: CliArgs = {
    json: false,
    trace: false,
    help: false,
  };

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];

    if (arg === "--json") {
      args.json = true;
      continue;
    }

    if (arg === "--config") {
      args.configPath = rawArgs[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--trace" || arg === "--debug") {
      args.trace = true;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      args.help = true;
      continue;
    }

    if (!args.rootDir) {
      args.rootDir = arg;
    }
  }

  return args;
}

function printHelp(): void {
  console.log(`Usage: scan-react-css [rootDir] [--config path] [--json] [--trace]`);
}

function printTrace(trace: AnalysisTrace, indent: string): void {
  console.log(`${indent}- ${trace.summary}`);
  for (const child of trace.children) {
    printTrace(child, `${indent}  `);
  }
}
