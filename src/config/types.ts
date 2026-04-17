export type RuleSeverity = "off" | "info" | "warning" | "error";

export type ConfidenceLevel = "low" | "medium" | "high";

export type OwnershipNamingConvention = "off" | "sibling";

export type ExternalCssMode = "imported-only";

export type RuleConfigObject = {
  severity: RuleSeverity;
  threshold?: number;
  minDeclarationOverlap?: number;
  minOccurrences?: number;
  minDeclarations?: number;
};

export type RuleConfigValue = RuleSeverity | RuleConfigObject;

export type RawReactCssScannerConfig = {
  $schema?: string;
  rootDir?: string;
  source?: {
    include?: string[];
    exclude?: string[];
  };
  css?: {
    global?: string[];
    utilities?: string[];
    modules?: {
      enabled?: boolean;
      patterns?: string[];
    };
  };
  ownership?: {
    pagePatterns?: string[];
    componentCssPatterns?: string[];
    namingConvention?: OwnershipNamingConvention;
  };
  externalCss?: {
    enabled?: boolean;
    mode?: ExternalCssMode;
  };
  classComposition?: {
    helpers?: string[];
  };
  policy?: {
    failOnSeverity?: Exclude<RuleSeverity, "off">;
  };
  rules?: Record<string, RuleConfigValue>;
};

export type ResolvedReactCssScannerConfig = {
  rootDir: string;
  source: {
    include: string[];
    exclude: string[];
  };
  css: {
    global: string[];
    utilities: string[];
    modules: {
      enabled: boolean;
      patterns: string[];
    };
  };
  ownership: {
    pagePatterns: string[];
    componentCssPatterns: string[];
    namingConvention: OwnershipNamingConvention;
  };
  externalCss: {
    enabled: boolean;
    mode: ExternalCssMode;
  };
  classComposition: {
    helpers: string[];
  };
  policy: {
    failOnSeverity: Exclude<RuleSeverity, "off">;
  };
  rules: Record<string, RuleConfigValue>;
};

export const DEFAULT_CONFIG: ResolvedReactCssScannerConfig = {
  rootDir: ".",
  source: {
    include: ["src"],
    exclude: ["dist", "build", "coverage", "node_modules"],
  },
  css: {
    global: [],
    utilities: ["**/utilities.css", "**/utilities/**/*.css"],
    modules: {
      enabled: true,
      patterns: ["**/*.module.css"],
    },
  },
  ownership: {
    pagePatterns: ["src/pages/**/*", "src/routes/**/*"],
    componentCssPatterns: [],
    namingConvention: "off",
  },
  externalCss: {
    enabled: true,
    mode: "imported-only",
  },
  classComposition: {
    helpers: ["classnames", "clsx"],
  },
  policy: {
    failOnSeverity: "error",
  },
  rules: {
    "component-css-should-be-global": {
      severity: "info",
      threshold: 8,
    },
    "repeated-style-pattern": {
      severity: "info",
      minOccurrences: 3,
      minDeclarations: 3,
    },
    "utility-class-replacement": {
      severity: "info",
      minDeclarationOverlap: 2,
    },
  },
};
