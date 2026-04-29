import type { LanguageFrontendsCompatibility, LanguageFrontendsResult } from "../types.js";

export function languageFrontendsToEngineInput(
  frontends: LanguageFrontendsResult,
): LanguageFrontendsCompatibility {
  return {
    sourceFiles: frontends.source.files.map((file) => ({
      filePath: file.filePath,
      sourceText: file.sourceText,
    })),
    parsedFiles: frontends.source.files.map((file) => file.legacy.parsedFile),
    selectorCssSources: frontends.css.files.map((file) => ({
      filePath: file.filePath,
      cssText: file.cssText,
    })),
    projectAnalysisStylesheets: frontends.css.files.map((file) => ({
      filePath: file.filePath,
      cssKind: file.cssKind,
      origin: file.origin,
    })),
    boundaries: [...frontends.snapshot.boundaries],
    resourceEdges: [...frontends.snapshot.edges],
    cssModules: frontends.snapshot.config.cssModules,
    externalCss: {
      fetchRemote: frontends.snapshot.externalCss.fetchRemote,
      globalProviders: frontends.snapshot.externalCss.globalProviders,
    },
    projectRoot: frontends.snapshot.rootDir,
  };
}
