import path from "node:path";
import { access } from "node:fs/promises";
import type { ResolvedReactCssScannerConfig } from "../config/types.js";
import { discoverProjectFiles } from "../files/discoverFiles.js";
import {
  extractCssFileFacts,
  extractExternalCssFacts,
  extractExternalCssFactsFromContent,
} from "./extractCssFacts.js";
import { extractHtmlFileFacts } from "./extractHtmlFacts.js";
import { extractSourceFileFacts } from "./extractSourceFacts.js";
import type { ProjectFactExtractionResult } from "./types.js";

export async function extractProjectFacts(
  config: ResolvedReactCssScannerConfig,
  cwd: string,
): Promise<ProjectFactExtractionResult> {
  const discoveredFiles = await discoverProjectFiles(config, cwd);
  const operationalWarnings: string[] = [];

  const [sourceFacts, cssFacts, htmlFacts] = await Promise.all([
    Promise.all(
      discoveredFiles.sourceFiles.map((sourceFile) =>
        extractSourceFileFacts(sourceFile, {
          rootDir: discoveredFiles.rootDir,
          config,
        }),
      ),
    ),
    Promise.all(discoveredFiles.cssFiles.map((cssFile) => extractCssFileFacts(cssFile))),
    Promise.all(discoveredFiles.htmlFiles.map((htmlFile) => extractHtmlFileFacts(htmlFile))),
  ]);

  const resolvedExternalCssImports = collectExternalCssImports(
    discoveredFiles.rootDir,
    sourceFacts,
  );
  const existingExternalCssImports = await filterExistingExternalCssImports(
    resolvedExternalCssImports,
  );
  const externalCssFacts = await Promise.all(
    existingExternalCssImports.map((externalCssImport) =>
      extractExternalCssFacts(externalCssImport),
    ),
  );
  const fetchedRemoteExternalCssFacts =
    config.externalCss.enabled && config.externalCss.mode === "fetch-remote"
      ? await fetchRemoteHtmlExternalCssFacts(htmlFacts, operationalWarnings)
      : [];

  return {
    rootDir: discoveredFiles.rootDir,
    sourceFacts: sourceFacts.sort((left, right) => left.filePath.localeCompare(right.filePath)),
    cssFacts: cssFacts.sort((left, right) => left.filePath.localeCompare(right.filePath)),
    externalCssFacts: [...externalCssFacts, ...fetchedRemoteExternalCssFacts].sort((left, right) =>
      left.specifier.localeCompare(right.specifier),
    ),
    htmlFacts: htmlFacts.sort((left, right) => left.filePath.localeCompare(right.filePath)),
    operationalWarnings,
  };
}

async function fetchRemoteHtmlExternalCssFacts(
  htmlFacts: ProjectFactExtractionResult["htmlFacts"],
  operationalWarnings: string[],
) {
  const remoteStylesheetHrefs = [
    ...new Set(
      htmlFacts
        .flatMap((htmlFact) => htmlFact.stylesheetLinks)
        .filter((stylesheetLink) => stylesheetLink.isRemote)
        .map((stylesheetLink) => stylesheetLink.href),
    ),
  ].sort((left, right) => left.localeCompare(right));

  const fetchResults = await Promise.all(
    remoteStylesheetHrefs.map(async (href) => {
      try {
        const response = await fetch(href);
        if (!response.ok) {
          operationalWarnings.push(
            `Could not fetch remote external CSS "${href}" (${response.status} ${response.statusText}); falling back to declared external CSS behavior.`,
          );
          return undefined;
        }

        const contentType = response.headers.get("content-type");
        if (contentType && !contentType.toLowerCase().includes("text/css")) {
          operationalWarnings.push(
            `Remote external CSS "${href}" returned unexpected content type "${contentType}"; falling back to declared external CSS behavior.`,
          );
          return undefined;
        }

        const content = await response.text();
        return extractExternalCssFactsFromContent({
          specifier: href,
          resolvedPath: href,
          content,
        });
      } catch (error) {
        const reason =
          error instanceof Error && error.message ? error.message : "unknown fetch failure";
        operationalWarnings.push(
          `Could not fetch remote external CSS "${href}" (${reason}); falling back to declared external CSS behavior.`,
        );
        return undefined;
      }
    }),
  );

  operationalWarnings.sort((left, right) => left.localeCompare(right));
  return fetchResults.filter((result) => result !== undefined);
}

async function filterExistingExternalCssImports(
  imports: Array<{ specifier: string; resolvedPath: string }>,
): Promise<Array<{ specifier: string; resolvedPath: string }>> {
  const results = await Promise.all(
    imports.map(async (item) => ({
      item,
      exists: await fileExists(item.resolvedPath),
    })),
  );

  return results.filter((result) => result.exists).map((result) => result.item);
}

function collectExternalCssImports(
  rootDir: string,
  sourceFacts: ProjectFactExtractionResult["sourceFacts"],
): Array<{ specifier: string; resolvedPath: string }> {
  const externalImports = new Map<string, string>();

  for (const sourceFact of sourceFacts) {
    for (const item of sourceFact.imports) {
      if (item.kind !== "external-css" || !item.resolvedPath) {
        continue;
      }

      externalImports.set(item.specifier, item.resolvedPath);
    }
  }

  return [...externalImports.entries()]
    .map(([specifier, resolvedPath]) => ({
      specifier,
      resolvedPath: path.isAbsolute(resolvedPath)
        ? resolvedPath
        : path.resolve(rootDir, resolvedPath),
    }))
    .sort((left, right) => left.specifier.localeCompare(right.specifier));
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
