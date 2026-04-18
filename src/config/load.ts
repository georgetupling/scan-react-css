import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileExists } from "../files/fsUtils.js";
import {
  DEFAULT_CONFIG,
  type ExternalCssGlobalProviderConfig,
  type ExternalCssMode,
  type OwnershipNamingConvention,
  type RawScanReactCssConfig,
  type ResolvedScanReactCssConfig,
  type RuleConfigObject,
  type RuleConfigValue,
  type RuleSeverity,
} from "./types.js";

const CONFIG_FILE_NAME = "scan-react-css.json";

const TOP_LEVEL_KEYS = new Set([
  "$schema",
  "rootDir",
  "source",
  "css",
  "ownership",
  "externalCss",
  "classComposition",
  "policy",
  "output",
  "rules",
]);

const SOURCE_KEYS = new Set(["include", "exclude"]);
const CSS_KEYS = new Set(["global", "utilities", "modules"]);
const CSS_MODULE_KEYS = new Set(["enabled", "patterns"]);
const OWNERSHIP_KEYS = new Set(["pagePatterns", "componentCssPatterns", "namingConvention"]);
const EXTERNAL_CSS_KEYS = new Set(["enabled", "mode", "globals"]);
const EXTERNAL_CSS_GLOBAL_KEYS = new Set(["provider", "match", "classPrefixes", "classNames"]);
const CLASS_COMPOSITION_KEYS = new Set(["helpers", "partialTemplateMatching"]);
const PARTIAL_TEMPLATE_MATCHING_KEYS = new Set(["enabled", "maxCandidates"]);
const POLICY_KEYS = new Set(["failOnSeverity"]);
const OUTPUT_KEYS = new Set(["minSeverity"]);
const RULE_OBJECT_KEYS = new Set([
  "severity",
  "threshold",
  "maxUtilityClasses",
  "minOccurrences",
  "minDeclarations",
]);

const RULE_SEVERITIES: RuleSeverity[] = ["off", "debug", "info", "warning", "error"];
const FAIL_ON_SEVERITIES: Array<Exclude<RuleSeverity, "off" | "debug">> = [
  "info",
  "warning",
  "error",
];
const OUTPUT_SEVERITIES: Array<Exclude<RuleSeverity, "off">> = [
  "debug",
  "info",
  "warning",
  "error",
];
const OWNERSHIP_NAMING_CONVENTIONS: OwnershipNamingConvention[] = ["off", "sibling"];
const EXTERNAL_CSS_MODES: ExternalCssMode[] = ["imported-only", "declared-globals", "fetch-remote"];

export type ConfigSourceKind =
  | "inline"
  | "explicit-path"
  | "project-root"
  | "env-dir"
  | "path"
  | "built-in-defaults";

export type ResolvedConfigSource = {
  kind: ConfigSourceKind;
  filePath?: string;
};

export type LoadScanReactCssConfigOptions = {
  cwd?: string;
  config?: RawScanReactCssConfig;
  configPath?: string;
  env?: Record<string, string | undefined>;
};

export type LoadedScanReactCssConfig = {
  config: ResolvedScanReactCssConfig;
  source: ResolvedConfigSource;
  warnings: string[];
};

export class ScanReactCssConfigError extends Error {
  readonly filePath?: string;
  readonly path?: string;

  constructor(message: string, options?: { filePath?: string; path?: string }) {
    super(message);
    this.name = "ScanReactCssConfigError";
    this.filePath = options?.filePath;
    this.path = options?.path;
  }
}

export async function loadScanReactCssConfig(
  options: LoadScanReactCssConfigOptions = {},
): Promise<LoadedScanReactCssConfig> {
  if (options.config !== undefined) {
    return {
      config: normalizeScanReactCssConfig(options.config),
      source: { kind: "inline" },
      warnings: [],
    };
  }

  const cwd = options.cwd ?? process.cwd();
  const env = options.env ?? process.env;
  const discoveredConfig = await discoverConfigFile({
    configPath: options.configPath,
    cwd,
    env,
  });

  if (!discoveredConfig) {
    return {
      config: cloneResolvedConfig(DEFAULT_CONFIG),
      source: { kind: "built-in-defaults" },
      warnings: [
        "No scan-react-css.json config file was found; built-in defaults were used. Create a config file to make scanner behavior explicit.",
      ],
    };
  }

  const configFilePath = discoveredConfig.filePath;

  if (!configFilePath) {
    throw new ScanReactCssConfigError(
      `Resolved config source "${discoveredConfig.kind}" is missing a file path`,
    );
  }

  const rawConfig = await readRawConfigFile(configFilePath);

  return {
    config: normalizeScanReactCssConfig(rawConfig, {
      filePath: configFilePath,
    }),
    source: discoveredConfig,
    warnings: [],
  };
}

export function normalizeScanReactCssConfig(
  rawConfig: RawScanReactCssConfig,
  options: { filePath?: string } = {},
): ResolvedScanReactCssConfig {
  assertPlainObject(rawConfig, "config", options.filePath);
  assertKnownKeys(rawConfig, TOP_LEVEL_KEYS, "config", options.filePath);

  const source = rawConfig.source;
  if (source !== undefined) {
    assertPlainObject(source, "config.source", options.filePath);
    assertKnownKeys(source, SOURCE_KEYS, "config.source", options.filePath);
  }

  const css = rawConfig.css;
  if (css !== undefined) {
    assertPlainObject(css, "config.css", options.filePath);
    assertKnownKeys(css, CSS_KEYS, "config.css", options.filePath);
  }

  const cssModules = css?.modules;
  if (cssModules !== undefined) {
    assertPlainObject(cssModules, "config.css.modules", options.filePath);
    assertKnownKeys(cssModules, CSS_MODULE_KEYS, "config.css.modules", options.filePath);
  }

  const ownership = rawConfig.ownership;
  if (ownership !== undefined) {
    assertPlainObject(ownership, "config.ownership", options.filePath);
    assertKnownKeys(ownership, OWNERSHIP_KEYS, "config.ownership", options.filePath);
  }

  const externalCss = rawConfig.externalCss;
  if (externalCss !== undefined) {
    assertPlainObject(externalCss, "config.externalCss", options.filePath);
    assertKnownKeys(externalCss, EXTERNAL_CSS_KEYS, "config.externalCss", options.filePath);
  }

  if (externalCss?.globals !== undefined) {
    if (!Array.isArray(externalCss.globals)) {
      throw new ScanReactCssConfigError(`Expected config.externalCss.globals to be an array`, {
        filePath: options.filePath,
        path: "config.externalCss.globals",
      });
    }

    for (const [index, globalEntry] of externalCss.globals.entries()) {
      assertPlainObject(globalEntry, `config.externalCss.globals[${index}]`, options.filePath);
      assertKnownKeys(
        globalEntry,
        EXTERNAL_CSS_GLOBAL_KEYS,
        `config.externalCss.globals[${index}]`,
        options.filePath,
      );
    }
  }

  const classComposition = rawConfig.classComposition;
  if (classComposition !== undefined) {
    assertPlainObject(classComposition, "config.classComposition", options.filePath);
    assertKnownKeys(
      classComposition,
      CLASS_COMPOSITION_KEYS,
      "config.classComposition",
      options.filePath,
    );
  }

  const partialTemplateMatching = classComposition?.partialTemplateMatching;
  if (partialTemplateMatching !== undefined) {
    assertPlainObject(
      partialTemplateMatching,
      "config.classComposition.partialTemplateMatching",
      options.filePath,
    );
    assertKnownKeys(
      partialTemplateMatching,
      PARTIAL_TEMPLATE_MATCHING_KEYS,
      "config.classComposition.partialTemplateMatching",
      options.filePath,
    );
  }

  const policy = rawConfig.policy;
  if (policy !== undefined) {
    assertPlainObject(policy, "config.policy", options.filePath);
    assertKnownKeys(policy, POLICY_KEYS, "config.policy", options.filePath);
  }

  const output = rawConfig.output;
  if (output !== undefined) {
    assertPlainObject(output, "config.output", options.filePath);
    assertKnownKeys(output, OUTPUT_KEYS, "config.output", options.filePath);
  }

  const rules = rawConfig.rules;
  if (rules !== undefined) {
    assertPlainObject(rules, "config.rules", options.filePath);
  }

  const resolvedRules = normalizeRules(rules, options.filePath);

  return {
    rootDir:
      normalizeString(rawConfig.rootDir, "config.rootDir", options.filePath) ??
      DEFAULT_CONFIG.rootDir,
    source: {
      include: normalizeStringArray(source?.include, "config.source.include", options.filePath) ?? [
        ...DEFAULT_CONFIG.source.include,
      ],
      exclude: normalizeStringArray(source?.exclude, "config.source.exclude", options.filePath) ?? [
        ...DEFAULT_CONFIG.source.exclude,
      ],
      discovery: source?.include === undefined ? "auto" : "explicit",
    },
    css: {
      global: normalizeStringArray(css?.global, "config.css.global", options.filePath) ?? [
        ...DEFAULT_CONFIG.css.global,
      ],
      utilities: normalizeStringArray(css?.utilities, "config.css.utilities", options.filePath) ?? [
        ...DEFAULT_CONFIG.css.utilities,
      ],
      modules: {
        enabled:
          normalizeBoolean(cssModules?.enabled, "config.css.modules.enabled", options.filePath) ??
          DEFAULT_CONFIG.css.modules.enabled,
        patterns: normalizeStringArray(
          cssModules?.patterns,
          "config.css.modules.patterns",
          options.filePath,
        ) ?? [...DEFAULT_CONFIG.css.modules.patterns],
      },
    },
    ownership: {
      pagePatterns: normalizeStringArray(
        ownership?.pagePatterns,
        "config.ownership.pagePatterns",
        options.filePath,
      ) ?? [...DEFAULT_CONFIG.ownership.pagePatterns],
      componentCssPatterns: normalizeStringArray(
        ownership?.componentCssPatterns,
        "config.ownership.componentCssPatterns",
        options.filePath,
      ) ?? [...DEFAULT_CONFIG.ownership.componentCssPatterns],
      namingConvention:
        normalizeEnum(
          ownership?.namingConvention,
          OWNERSHIP_NAMING_CONVENTIONS,
          "config.ownership.namingConvention",
          options.filePath,
        ) ?? DEFAULT_CONFIG.ownership.namingConvention,
    },
    externalCss: {
      enabled:
        normalizeBoolean(externalCss?.enabled, "config.externalCss.enabled", options.filePath) ??
        DEFAULT_CONFIG.externalCss.enabled,
      mode:
        normalizeEnum(
          externalCss?.mode,
          EXTERNAL_CSS_MODES,
          "config.externalCss.mode",
          options.filePath,
        ) ?? DEFAULT_CONFIG.externalCss.mode,
      globals:
        normalizeExternalCssGlobals(
          externalCss?.globals,
          "config.externalCss.globals",
          options.filePath,
        ) ?? cloneExternalCssGlobals(DEFAULT_CONFIG.externalCss.globals),
    },
    classComposition: {
      helpers: normalizeStringArray(
        classComposition?.helpers,
        "config.classComposition.helpers",
        options.filePath,
      ) ?? [...DEFAULT_CONFIG.classComposition.helpers],
      partialTemplateMatching: {
        enabled:
          normalizeBoolean(
            partialTemplateMatching?.enabled,
            "config.classComposition.partialTemplateMatching.enabled",
            options.filePath,
          ) ?? DEFAULT_CONFIG.classComposition.partialTemplateMatching.enabled,
        maxCandidates:
          partialTemplateMatching?.maxCandidates !== undefined
            ? normalizePositiveInteger(
                partialTemplateMatching.maxCandidates,
                "config.classComposition.partialTemplateMatching.maxCandidates",
                options.filePath,
              )
            : DEFAULT_CONFIG.classComposition.partialTemplateMatching.maxCandidates,
      },
    },
    policy: {
      failOnSeverity:
        normalizeEnum(
          policy?.failOnSeverity,
          FAIL_ON_SEVERITIES,
          "config.policy.failOnSeverity",
          options.filePath,
        ) ?? DEFAULT_CONFIG.policy.failOnSeverity,
    },
    output: {
      minSeverity:
        normalizeEnum(
          output?.minSeverity,
          OUTPUT_SEVERITIES,
          "config.output.minSeverity",
          options.filePath,
        ) ?? DEFAULT_CONFIG.output.minSeverity,
    },
    rules: resolvedRules,
  };
}

async function discoverConfigFile(options: {
  configPath?: string;
  cwd: string;
  env: Record<string, string | undefined>;
}): Promise<ResolvedConfigSource | undefined> {
  if (options.configPath) {
    const explicitPath = path.resolve(options.cwd, options.configPath);

    if (!(await fileExists(explicitPath))) {
      throw new ScanReactCssConfigError(`Explicit config path does not exist: ${explicitPath}`, {
        filePath: explicitPath,
      });
    }

    return {
      kind: "explicit-path",
      filePath: explicitPath,
    };
  }

  const projectRootPath = path.join(options.cwd, CONFIG_FILE_NAME);
  if (await fileExists(projectRootPath)) {
    return {
      kind: "project-root",
      filePath: projectRootPath,
    };
  }

  const envConfigDir = options.env.SCAN_REACT_CSS_CONFIG_DIR;
  if (envConfigDir) {
    const envConfigPath = path.resolve(options.cwd, envConfigDir, CONFIG_FILE_NAME);
    if (await fileExists(envConfigPath)) {
      return {
        kind: "env-dir",
        filePath: envConfigPath,
      };
    }
  }

  const pathValue = options.env.PATH;
  if (pathValue) {
    for (const entry of pathValue.split(path.delimiter)) {
      if (!entry) {
        continue;
      }

      const candidatePath = path.join(entry, CONFIG_FILE_NAME);
      if (await fileExists(candidatePath)) {
        return {
          kind: "path",
          filePath: candidatePath,
        };
      }
    }
  }

  return undefined;
}

async function readRawConfigFile(filePath: string): Promise<RawScanReactCssConfig> {
  let rawText: string;

  try {
    rawText = await readFile(filePath, "utf8");
  } catch {
    throw new ScanReactCssConfigError(`Could not read config file: ${filePath}`, { filePath });
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(rawText) as unknown;
  } catch {
    throw new ScanReactCssConfigError(`Config file is not valid JSON: ${filePath}`, {
      filePath,
    });
  }

  return parsed as RawScanReactCssConfig;
}

function normalizeRules(
  rules: RawScanReactCssConfig["rules"],
  filePath?: string,
): Record<string, RuleConfigValue> {
  const resolvedRules: Record<string, RuleConfigValue> = {};

  for (const [ruleId, defaultValue] of Object.entries(DEFAULT_CONFIG.rules)) {
    resolvedRules[ruleId] = cloneRuleConfigValue(defaultValue);
  }

  if (!rules) {
    return resolvedRules;
  }

  for (const [ruleId, value] of Object.entries(rules)) {
    resolvedRules[ruleId] = normalizeRuleConfigValue(value, `config.rules.${ruleId}`, filePath);
  }

  return resolvedRules;
}

function normalizeRuleConfigValue(
  value: RuleConfigValue,
  valuePath: string,
  filePath?: string,
): RuleConfigValue {
  if (typeof value === "string") {
    const normalizedSeverity = normalizeEnum(value, RULE_SEVERITIES, valuePath, filePath);

    if (!normalizedSeverity) {
      throw new ScanReactCssConfigError(
        `Expected ${valuePath} to be one of: ${RULE_SEVERITIES.join(", ")}`,
        { filePath, path: valuePath },
      );
    }

    return normalizedSeverity;
  }

  assertPlainObject(value, valuePath, filePath);
  assertKnownKeys(value, RULE_OBJECT_KEYS, valuePath, filePath);

  const severity = normalizeEnum(
    value.severity,
    RULE_SEVERITIES,
    `${valuePath}.severity`,
    filePath,
  );

  if (severity === undefined) {
    throw new ScanReactCssConfigError(`Missing required rule severity at ${valuePath}.severity`, {
      filePath,
      path: `${valuePath}.severity`,
    });
  }

  const normalizedRule: RuleConfigObject = { severity };

  if (value.threshold !== undefined) {
    normalizedRule.threshold = normalizePositiveInteger(
      value.threshold,
      `${valuePath}.threshold`,
      filePath,
    );
  }

  if (value.maxUtilityClasses !== undefined) {
    normalizedRule.maxUtilityClasses = normalizePositiveInteger(
      value.maxUtilityClasses,
      `${valuePath}.maxUtilityClasses`,
      filePath,
    );
  }

  if (value.minOccurrences !== undefined) {
    normalizedRule.minOccurrences = normalizePositiveInteger(
      value.minOccurrences,
      `${valuePath}.minOccurrences`,
      filePath,
    );
  }

  if (value.minDeclarations !== undefined) {
    normalizedRule.minDeclarations = normalizePositiveInteger(
      value.minDeclarations,
      `${valuePath}.minDeclarations`,
      filePath,
    );
  }

  return normalizedRule;
}

function cloneResolvedConfig(config: ResolvedScanReactCssConfig): ResolvedScanReactCssConfig {
  return {
    rootDir: config.rootDir,
    source: {
      include: [...config.source.include],
      exclude: [...config.source.exclude],
      discovery: config.source.discovery,
    },
    css: {
      global: [...config.css.global],
      utilities: [...config.css.utilities],
      modules: {
        enabled: config.css.modules.enabled,
        patterns: [...config.css.modules.patterns],
      },
    },
    ownership: {
      pagePatterns: [...config.ownership.pagePatterns],
      componentCssPatterns: [...config.ownership.componentCssPatterns],
      namingConvention: config.ownership.namingConvention,
    },
    externalCss: {
      enabled: config.externalCss.enabled,
      mode: config.externalCss.mode,
      globals: cloneExternalCssGlobals(config.externalCss.globals),
    },
    classComposition: {
      helpers: [...config.classComposition.helpers],
      partialTemplateMatching: {
        enabled: config.classComposition.partialTemplateMatching.enabled,
        maxCandidates: config.classComposition.partialTemplateMatching.maxCandidates,
      },
    },
    policy: {
      failOnSeverity: config.policy.failOnSeverity,
    },
    output: {
      minSeverity: config.output.minSeverity,
    },
    rules: Object.fromEntries(
      Object.entries(config.rules).map(([ruleId, value]) => [ruleId, cloneRuleConfigValue(value)]),
    ),
  };
}

function cloneRuleConfigValue(value: RuleConfigValue): RuleConfigValue {
  if (typeof value === "string") {
    return value;
  }

  return { ...value };
}

function cloneExternalCssGlobals(
  globals: ExternalCssGlobalProviderConfig[],
): ExternalCssGlobalProviderConfig[] {
  return globals.map((entry) => ({
    provider: entry.provider,
    match: [...entry.match],
    classPrefixes: [...entry.classPrefixes],
    classNames: [...entry.classNames],
  }));
}

function normalizeString(value: unknown, valuePath: string, filePath?: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || value.length === 0) {
    throw new ScanReactCssConfigError(`Expected ${valuePath} to be a non-empty string`, {
      filePath,
      path: valuePath,
    });
  }

  return value;
}

function normalizeBoolean(
  value: unknown,
  valuePath: string,
  filePath?: string,
): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "boolean") {
    throw new ScanReactCssConfigError(`Expected ${valuePath} to be a boolean`, {
      filePath,
      path: valuePath,
    });
  }

  return value;
}

function normalizeStringArray(
  value: unknown,
  valuePath: string,
  filePath?: string,
): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new ScanReactCssConfigError(`Expected ${valuePath} to be an array of strings`, {
      filePath,
      path: valuePath,
    });
  }

  return [...value];
}

function normalizeExternalCssGlobals(
  value: unknown,
  valuePath: string,
  filePath?: string,
): ExternalCssGlobalProviderConfig[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new ScanReactCssConfigError(`Expected ${valuePath} to be an array`, {
      filePath,
      path: valuePath,
    });
  }

  return value.map((entry, index) => {
    assertPlainObject(entry, `${valuePath}[${index}]`, filePath);
    assertKnownKeys(entry, EXTERNAL_CSS_GLOBAL_KEYS, `${valuePath}[${index}]`, filePath);

    const provider = normalizeString(entry.provider, `${valuePath}[${index}].provider`, filePath);
    const match = normalizeStringArray(entry.match, `${valuePath}[${index}].match`, filePath);

    if (!provider) {
      throw new ScanReactCssConfigError(
        `Missing required provider at ${valuePath}[${index}].provider`,
        {
          filePath,
          path: `${valuePath}[${index}].provider`,
        },
      );
    }

    if (!match || match.length === 0) {
      throw new ScanReactCssConfigError(
        `Expected ${valuePath}[${index}].match to contain at least one pattern`,
        {
          filePath,
          path: `${valuePath}[${index}].match`,
        },
      );
    }

    return {
      provider,
      match,
      classPrefixes:
        normalizeStringArray(
          entry.classPrefixes,
          `${valuePath}[${index}].classPrefixes`,
          filePath,
        ) ?? [],
      classNames:
        normalizeStringArray(entry.classNames, `${valuePath}[${index}].classNames`, filePath) ?? [],
    };
  });
}

function normalizePositiveInteger(value: unknown, valuePath: string, filePath?: string): number {
  if (!Number.isInteger(value) || (value as number) <= 0) {
    throw new ScanReactCssConfigError(`Expected ${valuePath} to be a positive integer`, {
      filePath,
      path: valuePath,
    });
  }

  return value as number;
}

function normalizeEnum<T extends string>(
  value: unknown,
  allowedValues: readonly T[],
  valuePath: string,
  filePath?: string,
): T | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || !allowedValues.includes(value as T)) {
    throw new ScanReactCssConfigError(
      `Expected ${valuePath} to be one of: ${allowedValues.join(", ")}`,
      { filePath, path: valuePath },
    );
  }

  return value as T;
}

function assertPlainObject(
  value: unknown,
  valuePath: string,
  filePath?: string,
): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ScanReactCssConfigError(`Expected ${valuePath} to be an object`, {
      filePath,
      path: valuePath,
    });
  }
}

function assertKnownKeys(
  value: Record<string, unknown>,
  allowedKeys: Set<string>,
  valuePath: string,
  filePath?: string,
): void {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      throw new ScanReactCssConfigError(`Unknown config key "${key}" at ${valuePath}`, {
        filePath,
        path: `${valuePath}.${key}`,
      });
    }
  }
}
