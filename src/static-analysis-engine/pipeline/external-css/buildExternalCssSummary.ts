import type {
  ActiveExternalCssProvider,
  ExternalCssAnalysisInput,
  ExternalCssGlobalProviderConfig,
  ExternalCssSummary,
  HtmlStylesheetLinkInput,
} from "./types.js";

export function buildExternalCssSummary(
  input: ExternalCssAnalysisInput | undefined,
): ExternalCssSummary {
  const enabled = input?.enabled ?? false;
  const mode = input?.mode ?? "imported-only";
  const htmlStylesheetLinks = normalizeHtmlStylesheetLinks(input?.htmlStylesheetLinks ?? []);
  const globalProviders = normalizeGlobalProviders(input?.globalProviders ?? []);

  if (!enabled) {
    return {
      enabled,
      mode,
      activeProviders: [],
      projectWideStylesheetFilePaths: [],
    };
  }

  return {
    enabled,
    mode,
    activeProviders:
      mode === "declared-globals" || mode === "fetch-remote"
        ? buildActiveProviders({
            globalProviders,
            htmlStylesheetLinks,
          })
        : [],
    projectWideStylesheetFilePaths:
      mode === "fetch-remote"
        ? [
            ...new Set(
              htmlStylesheetLinks
                .filter((stylesheetLink) => stylesheetLink.isRemote)
                .map((stylesheetLink) => stylesheetLink.href),
            ),
          ].sort((left, right) => left.localeCompare(right))
        : [],
  };
}

function buildActiveProviders(input: {
  globalProviders: ExternalCssGlobalProviderConfig[];
  htmlStylesheetLinks: HtmlStylesheetLinkInput[];
}): ActiveExternalCssProvider[] {
  const activeProviders = new Map<string, ActiveExternalCssProvider>();

  for (const stylesheetLink of input.htmlStylesheetLinks) {
    for (const provider of input.globalProviders) {
      if (!matchesAnyGlob(stylesheetLink.href, provider.match)) {
        continue;
      }

      const existingProvider = activeProviders.get(provider.provider);
      if (existingProvider) {
        existingProvider.matchedStylesheets.push(stylesheetLink);
        existingProvider.matchedStylesheets.sort(compareStylesheetLinks);
        continue;
      }

      activeProviders.set(provider.provider, {
        provider: provider.provider,
        match: [...provider.match],
        classPrefixes: [...provider.classPrefixes],
        classNames: [...provider.classNames],
        matchedStylesheets: [stylesheetLink],
      });
    }
  }

  return [...activeProviders.values()].sort((left, right) =>
    left.provider.localeCompare(right.provider),
  );
}

function normalizeGlobalProviders(
  providers: ExternalCssGlobalProviderConfig[],
): ExternalCssGlobalProviderConfig[] {
  return providers
    .map((provider) => ({
      provider: provider.provider,
      match: [...provider.match],
      classPrefixes: [...provider.classPrefixes].sort((left, right) => left.localeCompare(right)),
      classNames: [...provider.classNames].sort((left, right) => left.localeCompare(right)),
    }))
    .sort((left, right) => left.provider.localeCompare(right.provider));
}

function normalizeHtmlStylesheetLinks(
  stylesheetLinks: HtmlStylesheetLinkInput[],
): HtmlStylesheetLinkInput[] {
  return [...stylesheetLinks]
    .map((stylesheetLink) => ({
      filePath: stylesheetLink.filePath.replace(/\\/g, "/"),
      href: stylesheetLink.href,
      isRemote: stylesheetLink.isRemote,
    }))
    .sort(compareStylesheetLinks);
}

function compareStylesheetLinks(
  left: HtmlStylesheetLinkInput,
  right: HtmlStylesheetLinkInput,
): number {
  if (left.filePath === right.filePath) {
    return left.href.localeCompare(right.href);
  }

  return left.filePath.localeCompare(right.filePath);
}

function matchesAnyGlob(value: string, patterns: readonly string[]): boolean {
  const normalizedValue = normalizePathForMatch(value);
  return patterns.some((pattern) => globToRegExp(pattern).test(normalizedValue));
}

function normalizePathForMatch(value: string): string {
  return value.replace(/\\/g, "/");
}

function globToRegExp(globPattern: string): RegExp {
  const normalizedPattern = normalizePathForMatch(globPattern);
  let pattern = "^";

  for (let index = 0; index < normalizedPattern.length; index += 1) {
    const char = normalizedPattern[index];
    const nextChar = normalizedPattern[index + 1];
    const nextNextChar = normalizedPattern[index + 2];

    if (char === "*") {
      if (nextChar === "*") {
        if (nextNextChar === "/") {
          pattern += "(?:.*/)?";
          index += 2;
        } else {
          pattern += ".*";
          index += 1;
        }
      } else {
        pattern += "[^/]*";
      }
      continue;
    }

    if (char === "?") {
      pattern += ".";
      continue;
    }

    if ("/.+^${}()|[]\\".includes(char)) {
      pattern += `\\${char}`;
      continue;
    }

    pattern += char;
  }

  pattern += "$";
  return new RegExp(pattern);
}
