import { analyzeProjectSourceTexts } from "../../entry/scan.js";
import type { ProjectModel } from "../../../model/types.js";
import type { StaticAnalysisEngineResult } from "../../types/runtime.js";

type ProjectAnalysisOptions = {
  includeExternalCssSources?: boolean;
};

const projectModelAnalysisCache = new WeakMap<
  ProjectModel,
  Map<string, StaticAnalysisEngineResult>
>();

export function analyzeProjectModelWithStaticEngine(
  model: ProjectModel,
  options: ProjectAnalysisOptions = {},
): StaticAnalysisEngineResult {
  const cacheKey = createCacheKey(options);
  const cachedAnalyses = projectModelAnalysisCache.get(model);
  const cachedAnalysis = cachedAnalyses?.get(cacheKey);
  if (cachedAnalysis) {
    return cachedAnalysis;
  }

  const analysis = analyzeProjectSourceTexts({
    sourceFiles: model.facts.sourceFacts
      .map((sourceFact) => ({
        filePath: sourceFact.filePath,
        sourceText: sourceFact.content,
      }))
      .sort((left, right) => left.filePath.localeCompare(right.filePath)),
    selectorCssSources: buildSelectorCssSources(model, options),
    externalCss: {
      enabled: model.config.externalCss.enabled,
      mode: model.config.externalCss.mode,
      globalProviders: model.config.externalCss.globals.map((provider) => ({
        provider: provider.provider,
        match: [...provider.match],
        classPrefixes: [...provider.classPrefixes],
        classNames: [...provider.classNames],
      })),
      htmlStylesheetLinks: model.facts.htmlFacts.flatMap((htmlFact) =>
        htmlFact.stylesheetLinks.map((stylesheetLink) => ({
          filePath: htmlFact.filePath,
          href: stylesheetLink.href,
          isRemote: stylesheetLink.isRemote,
        })),
      ),
    },
  });

  const nextCachedAnalyses = cachedAnalyses ?? new Map<string, StaticAnalysisEngineResult>();
  nextCachedAnalyses.set(cacheKey, analysis);
  if (!cachedAnalyses) {
    projectModelAnalysisCache.set(model, nextCachedAnalyses);
  }

  return analysis;
}

function buildSelectorCssSources(
  model: ProjectModel,
  options: ProjectAnalysisOptions,
): Array<{
  filePath: string;
  cssText: string;
}> {
  const cssSources = model.facts.cssFacts.map((cssFact) => ({
    filePath: cssFact.filePath,
    cssText: cssFact.content,
  }));
  if (!options.includeExternalCssSources) {
    return cssSources.sort((left, right) => left.filePath.localeCompare(right.filePath));
  }

  return [
    ...cssSources,
    ...model.facts.externalCssFacts.map((externalCssFact) => ({
      filePath: externalCssFact.specifier,
      cssText: externalCssFact.content,
    })),
  ].sort((left, right) => left.filePath.localeCompare(right.filePath));
}

function createCacheKey(options: ProjectAnalysisOptions): string {
  return options.includeExternalCssSources ? "with-external-css" : "project-css-only";
}
