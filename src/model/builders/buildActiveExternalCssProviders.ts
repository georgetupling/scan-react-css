import type { ResolvedScanReactCssConfig } from "../../config/types.js";
import type { ProjectFactExtractionResult } from "../../facts/types.js";
import { matchesAnyGlob } from "../../files/pathUtils.js";
import type { ProjectIndexes } from "../types.js";

export function buildActiveExternalCssProviders(
  config: ResolvedScanReactCssConfig,
  facts: ProjectFactExtractionResult,
): ProjectIndexes["activeExternalCssProviders"] {
  const activeProviders = new Map<
    string,
    ProjectIndexes["activeExternalCssProviders"] extends Map<string, infer V> ? V : never
  >();

  if (
    !config.externalCss.enabled ||
    (config.externalCss.mode !== "declared-globals" && config.externalCss.mode !== "fetch-remote")
  ) {
    return activeProviders;
  }

  for (const htmlFact of facts.htmlFacts) {
    for (const stylesheetLink of htmlFact.stylesheetLinks) {
      for (const provider of config.externalCss.globals) {
        if (!matchesAnyGlob(stylesheetLink.href, provider.match)) {
          continue;
        }

        const existingProvider = activeProviders.get(provider.provider);
        if (existingProvider) {
          existingProvider.matchedStylesheets.push({
            filePath: htmlFact.filePath,
            href: stylesheetLink.href,
            isRemote: stylesheetLink.isRemote,
          });
          existingProvider.matchedStylesheets.sort((left, right) => {
            if (left.filePath === right.filePath) {
              return left.href.localeCompare(right.href);
            }

            return left.filePath.localeCompare(right.filePath);
          });
          continue;
        }

        activeProviders.set(provider.provider, {
          provider: provider.provider,
          match: [...provider.match],
          classPrefixes: [...provider.classPrefixes],
          classNames: [...provider.classNames],
          matchedStylesheets: [
            {
              filePath: htmlFact.filePath,
              href: stylesheetLink.href,
              isRemote: stylesheetLink.isRemote,
            },
          ],
        });
      }
    }
  }

  return activeProviders;
}
