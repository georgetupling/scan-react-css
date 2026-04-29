import type { ProjectSnapshot, ProjectSnapshotEngineInput } from "../types.js";

export function projectSnapshotToEngineInput(
  snapshot: ProjectSnapshot,
): ProjectSnapshotEngineInput {
  return {
    sourceFiles: snapshot.files.sourceFiles.map((sourceFile) => ({
      filePath: sourceFile.filePath,
      sourceText: sourceFile.sourceText,
    })),
    projectRoot: snapshot.rootDir,
    selectorCssSources: snapshot.files.stylesheets.map((stylesheet) => ({
      filePath: stylesheet.filePath,
      cssText: stylesheet.cssText,
    })),
    cssModules: snapshot.config.cssModules,
    externalCss: {
      fetchRemote: snapshot.externalCss.fetchRemote,
      globalProviders: snapshot.externalCss.globalProviders,
      htmlStylesheetLinks: snapshot.externalCss.htmlStylesheetLinks,
      htmlScriptSources: snapshot.externalCss.htmlScriptSources,
      packageCssImports: snapshot.externalCss.packageCssImports,
    },
  };
}
