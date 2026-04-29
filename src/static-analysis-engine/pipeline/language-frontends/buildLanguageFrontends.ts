import { analyzeCssSources } from "../css-analysis/index.js";
import { parseSourceFile } from "../parse/index.js";
import { extractSelectorQueriesFromCssText } from "../selector-analysis/index.js";
import type { ProjectSnapshot } from "../workspace-discovery/index.js";
import type {
  CssFrontendFacts,
  CssFrontendFile,
  LanguageFrontendsResult,
  SourceFrontendFacts,
  SourceFrontendFile,
  SourceLanguageKind,
} from "./types.js";

export function buildLanguageFrontends(input: {
  snapshot: ProjectSnapshot;
}): LanguageFrontendsResult {
  const source = buildSourceFrontendFacts(input.snapshot);
  const css = buildCssFrontendFacts(input.snapshot);

  return {
    snapshot: input.snapshot,
    source,
    css,
    compatibility: {
      sourceFiles: source.files.map((file) => ({
        filePath: file.filePath,
        sourceText: file.sourceText,
      })),
      parsedFiles: source.files.map((file) => file.legacy.parsedFile),
      selectorCssSources: css.files.map((file) => ({
        filePath: file.filePath,
        cssText: file.cssText,
      })),
      projectAnalysisStylesheets: css.files.map((file) => ({
        filePath: file.filePath,
        cssKind: file.cssKind,
        origin: file.origin,
      })),
      boundaries: [...input.snapshot.boundaries],
      resourceEdges: [...input.snapshot.edges],
      cssModules: input.snapshot.config.cssModules,
      externalCss: {
        fetchRemote: input.snapshot.externalCss.fetchRemote,
        globalProviders: input.snapshot.externalCss.globalProviders,
      },
      projectRoot: input.snapshot.rootDir,
    },
  };
}

function buildSourceFrontendFacts(snapshot: ProjectSnapshot): SourceFrontendFacts {
  const files: SourceFrontendFile[] = [...snapshot.files.sourceFiles]
    .sort((left, right) => left.filePath.localeCompare(right.filePath))
    .map((sourceFile) => {
      const parsedFile = {
        filePath: sourceFile.filePath,
        parsedSourceFile: parseSourceFile(sourceFile),
      };

      return {
        filePath: sourceFile.filePath,
        absolutePath: sourceFile.absolutePath,
        languageKind: getSourceLanguageKind(sourceFile.filePath),
        sourceText: sourceFile.sourceText,
        legacy: {
          parsedFile,
        },
      };
    });

  return {
    files,
    filesByPath: new Map(files.map((file) => [file.filePath, file])),
  };
}

function buildCssFrontendFacts(snapshot: ProjectSnapshot): CssFrontendFacts {
  const files: CssFrontendFile[] = [...snapshot.files.stylesheets]
    .sort((left, right) => left.filePath.localeCompare(right.filePath))
    .map((stylesheet) => {
      const selectorSource = {
        filePath: stylesheet.filePath,
        cssText: stylesheet.cssText,
      };

      return {
        filePath: stylesheet.filePath,
        absolutePath: stylesheet.absolutePath,
        cssText: stylesheet.cssText,
        cssKind: stylesheet.cssKind,
        origin: stylesheet.origin,
        analysis: analyzeCssSources([selectorSource])[0] ?? {
          filePath: stylesheet.filePath,
          styleRules: [],
          classDefinitions: [],
          classContexts: [],
          atRuleContexts: [],
        },
        selectorQueries: extractSelectorQueriesFromCssText(selectorSource),
      };
    });

  return {
    files,
    filesByPath: new Map(files.map((file) => [file.filePath, file])),
  };
}

function getSourceLanguageKind(filePath: string): SourceLanguageKind {
  if (/\.tsx$/i.test(filePath)) {
    return "tsx";
  }

  if (/\.jsx$/i.test(filePath)) {
    return "jsx";
  }

  if (/\.ts$/i.test(filePath)) {
    return "ts";
  }

  return "js";
}
