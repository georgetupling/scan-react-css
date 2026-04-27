import type ts from "typescript";

import type { ParsedProjectFile } from "../../entry/stages/types.js";
import { createProjectResolutionCaches } from "./cache.js";
import { collectDeclarations } from "./collectDeclarations.js";
import { applyExportEvidenceToDeclarations, collectExports } from "./collectExports.js";
import { collectImports } from "./collectImports.js";
import { collectWorkspacePackageEntryPoints } from "./workspaceEntryPoints.js";
import { normalizeFilePath } from "./pathUtils.js";
import type {
  ProjectResolution,
  ProjectResolutionExportRecord,
  ProjectResolutionFileDeclarationIndex,
  ProjectResolutionImportRecord,
} from "./types.js";

export function buildProjectResolution(input: {
  parsedFiles: ParsedProjectFile[];
}): ProjectResolution {
  const sortedParsedFiles = [...input.parsedFiles].sort((left, right) =>
    normalizeFilePath(left.filePath).localeCompare(normalizeFilePath(right.filePath)),
  );
  const parsedSourceFilesByFilePath = new Map<string, ts.SourceFile>();
  const importsByFilePath = new Map<string, ProjectResolutionImportRecord[]>();
  const exportsByFilePath = new Map<string, ProjectResolutionExportRecord[]>();
  const declarationsByFilePath = new Map<string, ProjectResolutionFileDeclarationIndex>();

  for (const parsedFile of sortedParsedFiles) {
    const filePath = normalizeFilePath(parsedFile.filePath);
    parsedSourceFilesByFilePath.set(filePath, parsedFile.parsedSourceFile);
    importsByFilePath.set(filePath, collectImports(filePath, parsedFile.parsedSourceFile));

    const declarations = collectDeclarations(parsedFile.parsedSourceFile);
    const exports = collectExports(filePath, parsedFile.parsedSourceFile);
    applyExportEvidenceToDeclarations(declarations, exports);

    exportsByFilePath.set(filePath, exports);
    declarationsByFilePath.set(filePath, declarations);
  }

  return {
    parsedSourceFilesByFilePath,
    importsByFilePath,
    exportsByFilePath,
    declarationsByFilePath,
    workspacePackageEntryPointsByPackageName: collectWorkspacePackageEntryPoints(sortedParsedFiles),
    caches: createProjectResolutionCaches(),
  };
}
