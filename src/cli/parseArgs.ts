import type { FindingSeverity } from "../runtime/types.js";
import type { OutputVerbosity } from "./format.js";

export type ParsedCliArgs = {
  targetPath?: string;
  focusPath?: string;
  configPath?: string;
  json: boolean;
  outputMinSeverity?: FindingSeverity;
  outputFile?: string;
  overwriteOutput: boolean;
  printConfig: boolean;
  verbosity: OutputVerbosity;
};

export class CliArgumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliArgumentError";
  }
}

const SEVERITIES: FindingSeverity[] = ["debug", "info", "warning", "error"];
const BOOLEAN_FLAG_VALUES = ["on", "off"] as const;
const VERBOSITY_LEVELS: OutputVerbosity[] = ["low", "medium", "high"];

export function parseCliArgs(argv: string[]): ParsedCliArgs {
  const args = argv.slice(2);
  const parsed: ParsedCliArgs = {
    json: false,
    overwriteOutput: false,
    printConfig: false,
    verbosity: "medium",
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (!arg.startsWith("-")) {
      if (parsed.targetPath) {
        throw new CliArgumentError(`Unexpected extra positional argument: ${arg}`);
      }

      parsed.targetPath = arg;
      continue;
    }

    if (arg === "--json") {
      parsed.json = true;
      continue;
    }

    if (arg === "--overwrite-output") {
      parsed.overwriteOutput = true;
      continue;
    }

    if (arg === "--config") {
      parsed.configPath = readNextValue(args, ++index, "--config");
      continue;
    }

    if (arg === "--focus") {
      parsed.focusPath = readNextValue(args, ++index, "--focus");
      continue;
    }

    if (arg === "--output-min-severity") {
      const value = readNextValue(args, ++index, "--output-min-severity");
      if (!SEVERITIES.includes(value as FindingSeverity)) {
        throw new CliArgumentError(
          `Invalid value for --output-min-severity: ${value}. Expected one of ${SEVERITIES.join(", ")}`,
        );
      }
      parsed.outputMinSeverity = value as FindingSeverity;
      continue;
    }

    if (arg === "--output-file") {
      parsed.outputFile = readNextValue(args, ++index, "--output-file");
      continue;
    }

    if (arg === "--print-config") {
      const value = readNextValue(args, ++index, "--print-config");
      if (!BOOLEAN_FLAG_VALUES.includes(value as (typeof BOOLEAN_FLAG_VALUES)[number])) {
        throw new CliArgumentError(
          `Invalid value for --print-config: ${value}. Expected one of ${BOOLEAN_FLAG_VALUES.join(", ")}`,
        );
      }
      parsed.printConfig = value === "on";
      continue;
    }

    if (arg === "--verbosity") {
      const value = readNextValue(args, ++index, "--verbosity");
      if (!VERBOSITY_LEVELS.includes(value as OutputVerbosity)) {
        throw new CliArgumentError(
          `Invalid value for --verbosity: ${value}. Expected one of ${VERBOSITY_LEVELS.join(", ")}`,
        );
      }
      parsed.verbosity = value as OutputVerbosity;
      continue;
    }

    throw new CliArgumentError(`Unknown CLI flag: ${arg}`);
  }

  if (parsed.outputFile && !parsed.json) {
    throw new CliArgumentError("--output-file requires --json");
  }

  return parsed;
}

function readNextValue(args: string[], index: number, flag: string): string {
  const value = args[index];
  if (!value || value.startsWith("-")) {
    throw new CliArgumentError(`Missing value for ${flag}`);
  }

  return value;
}
