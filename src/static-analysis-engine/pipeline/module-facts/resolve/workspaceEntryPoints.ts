import path from "node:path";

import type { ParsedProjectFile } from "../../../entry/stages/types.js";
import type { WorkspacePackageEntryPoint } from "../types.js";
import { normalizeFilePath } from "../shared/pathUtils.js";

export function collectWorkspacePackageEntryPoints(
  parsedFiles: ParsedProjectFile[],
): Map<string, WorkspacePackageEntryPoint[]> {
  const entryPointsByPackageName = new Map<string, WorkspacePackageEntryPoint[]>();

  for (const parsedFile of parsedFiles) {
    const filePath = normalizeFilePath(parsedFile.filePath);
    const parsedPath = path.parse(filePath);
    if (!/^index\.[cm]?[jt]sx?$/.test(parsedPath.base)) {
      continue;
    }

    const packageName = inferWorkspacePackageName(filePath);
    if (!packageName) {
      continue;
    }

    const entryPoints = entryPointsByPackageName.get(packageName) ?? [];
    entryPoints.push({
      packageName,
      filePath,
      confidence: "heuristic",
      reason: "discovered-workspace-entrypoint",
    });
    entryPointsByPackageName.set(packageName, entryPoints);
  }

  for (const entryPoints of entryPointsByPackageName.values()) {
    entryPoints.sort((left, right) => left.filePath.localeCompare(right.filePath));
  }

  return new Map(
    [...entryPointsByPackageName.entries()].sort(([left], [right]) => left.localeCompare(right)),
  );
}

function inferWorkspacePackageName(filePath: string): string | undefined {
  const segments = filePath.split("/");
  const fileName = segments.at(-1);
  if (!fileName || !/^index\.[cm]?[jt]sx?$/.test(fileName)) {
    return undefined;
  }

  const parentName = segments.at(-2);
  if (!parentName) {
    return undefined;
  }

  if (parentName === "src") {
    const packageName = segments.at(-3);
    const scopeName = segments.at(-4);
    if (packageName?.startsWith("@")) {
      return undefined;
    }
    if (scopeName?.startsWith("@") && packageName) {
      return `${scopeName}/${packageName}`;
    }
    return packageName;
  }

  const scopeName = segments.at(-3);
  if (scopeName?.startsWith("@")) {
    return `${scopeName}/${parentName}`;
  }

  return parentName;
}
