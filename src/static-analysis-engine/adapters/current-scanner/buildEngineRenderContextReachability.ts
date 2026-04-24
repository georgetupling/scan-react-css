import type { ProjectModel } from "../../../model/types.js";
import type {
  ReachabilitySummary,
  StylesheetReachabilityContextRecord,
} from "../../pipeline/reachability/types.js";

type EngineRenderContextReachability = {
  renderContextDefiniteLocalCss: Set<string>;
  renderContextPossibleLocalCss: Set<string>;
};

export function buildEngineRenderContextReachabilityBySourceFile(
  model: ProjectModel,
  reachabilitySummary: ReachabilitySummary,
): Map<string, EngineRenderContextReachability> {
  const reachabilityBySourceFile = new Map<string, EngineRenderContextReachability>();

  for (const sourceFile of model.graph.sourceFiles) {
    reachabilityBySourceFile.set(sourceFile.path, {
      renderContextDefiniteLocalCss: new Set<string>(),
      renderContextPossibleLocalCss: new Set<string>(),
    });
  }

  for (const stylesheet of reachabilitySummary.stylesheets) {
    const cssFilePath = normalizeProjectPath(stylesheet.cssFilePath);
    if (!cssFilePath) {
      continue;
    }

    const availabilityBySourceFile = new Map<string, "definite" | "possible">();
    for (const contextRecord of stylesheet.contexts) {
      const sourceFilePath = getRenderContextSourceFilePath(contextRecord);
      if (!sourceFilePath) {
        continue;
      }

      const availability = toCollapsedRenderContextAvailability(contextRecord);
      if (!availability) {
        continue;
      }

      const currentAvailability = availabilityBySourceFile.get(sourceFilePath);
      availabilityBySourceFile.set(
        sourceFilePath,
        currentAvailability === "possible" || availability === "possible" ? "possible" : "definite",
      );
    }

    for (const [sourceFilePath, availability] of availabilityBySourceFile.entries()) {
      const sourceFileReachability = reachabilityBySourceFile.get(sourceFilePath);
      if (!sourceFileReachability) {
        continue;
      }

      if (availability === "possible") {
        sourceFileReachability.renderContextPossibleLocalCss.add(cssFilePath);
        sourceFileReachability.renderContextDefiniteLocalCss.delete(cssFilePath);
        continue;
      }

      if (!sourceFileReachability.renderContextPossibleLocalCss.has(cssFilePath)) {
        sourceFileReachability.renderContextDefiniteLocalCss.add(cssFilePath);
      }
    }
  }

  return new Map(
    [...reachabilityBySourceFile.entries()].map(([sourceFilePath, sourceFileReachability]) => [
      sourceFilePath,
      {
        renderContextDefiniteLocalCss: new Set(
          [...sourceFileReachability.renderContextDefiniteLocalCss].sort((left, right) =>
            left.localeCompare(right),
          ),
        ),
        renderContextPossibleLocalCss: new Set(
          [...sourceFileReachability.renderContextPossibleLocalCss].sort((left, right) =>
            left.localeCompare(right),
          ),
        ),
      },
    ]),
  );
}

function getRenderContextSourceFilePath(
  contextRecord: StylesheetReachabilityContextRecord,
): string | undefined {
  if (contextRecord.context.kind === "source-file") {
    return undefined;
  }

  const sourceFilePath = normalizeProjectPath(contextRecord.context.filePath);
  return sourceFilePath;
}

function toCollapsedRenderContextAvailability(
  contextRecord: StylesheetReachabilityContextRecord,
): "definite" | "possible" | undefined {
  if (contextRecord.availability !== "definite" && contextRecord.availability !== "possible") {
    return undefined;
  }

  if (
    contextRecord.derivations.length > 0 &&
    contextRecord.derivations.every(
      (derivation) => derivation.kind === "whole-component-direct-import",
    )
  ) {
    return undefined;
  }

  return contextRecord.availability;
}

function normalizeProjectPath(filePath: string | undefined): string | undefined {
  return filePath?.replace(/\\/g, "/");
}
