import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import type { CompatibilityResolvedConfig } from "../../runtime/compatTypes.js";

export type ProjectFileKind = "source" | "css" | "html";

export type DiscoveredProjectFile = {
  kind: ProjectFileKind;
  absolutePath: string;
  relativePath: string;
};

export type FileDiscoveryResult = {
  rootDir: string;
  sourceFiles: DiscoveredProjectFile[];
  cssFiles: DiscoveredProjectFile[];
  htmlFiles: DiscoveredProjectFile[];
};

export async function discoverProjectFilesForComparison(
  config: CompatibilityResolvedConfig,
  cwd: string,
): Promise<FileDiscoveryResult> {
  const rootDir = path.resolve(cwd, config.rootDir);
  const includePatterns =
    config.source.discovery === "auto"
      ? await discoverReactSourceIncludePaths(rootDir, config.source.exclude)
      : config.source.include;
  const discoveredFiles: DiscoveredProjectFile[] = [];
  await walkDirectory(rootDir, rootDir, config, includePatterns, discoveredFiles);

  const sourceFiles = discoveredFiles
    .filter((file) => file.kind === "source")
    .sort(compareDiscoveredFiles);
  const cssFiles = discoveredFiles
    .filter((file) => file.kind === "css")
    .sort(compareDiscoveredFiles);
  const htmlFiles = discoveredFiles
    .filter((file) => file.kind === "html")
    .sort(compareDiscoveredFiles);

  if (sourceFiles.length === 0 && cssFiles.length === 0 && htmlFiles.length === 0) {
    const includeSummary =
      includePatterns.length > 0 ? includePatterns.join(", ") : "(none resolved)";
    throw new Error(
      config.source.discovery === "auto"
        ? `React source roots were resolved automatically (${includeSummary}), but no project files were found to scan. Point the scanner at the correct project root or configure source.include explicitly.`
        : `No project files were found under source.include (${includeSummary}). Check the configured paths or point the scanner at the correct project root.`,
    );
  }

  return {
    rootDir,
    sourceFiles,
    cssFiles,
    htmlFiles,
  };
}

async function walkDirectory(
  currentDir: string,
  rootDir: string,
  config: CompatibilityResolvedConfig,
  includePatterns: string[],
  results: DiscoveredProjectFile[],
): Promise<void> {
  const entries = await readdir(currentDir, { withFileTypes: true });

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const absolutePath = path.join(currentDir, entry.name);
    const relativePath = normalizePathForMatch(path.relative(rootDir, absolutePath));

    if (entry.isDirectory()) {
      if (shouldExcludePath(relativePath, config.source.exclude)) {
        continue;
      }

      await walkDirectory(absolutePath, rootDir, config, includePatterns, results);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (shouldExcludePath(relativePath, config.source.exclude)) {
      continue;
    }

    const kind = getFileKind(relativePath);
    if (!kind) {
      continue;
    }

    if (kind !== "html" && !shouldIncludePath(relativePath, includePatterns)) {
      continue;
    }

    results.push({
      kind,
      absolutePath,
      relativePath,
    });
  }
}

function shouldExcludePath(relativePath: string, excludePatterns: string[]): boolean {
  if (!relativePath) {
    return false;
  }

  return excludePatterns.some((pattern) => {
    const normalizedPattern = normalizePathForMatch(pattern);
    return (
      matchesAnyGlob(relativePath, [normalizedPattern]) ||
      relativePath === normalizedPattern ||
      relativePath.startsWith(`${normalizedPattern}/`)
    );
  });
}

function shouldIncludePath(relativePath: string, includePatterns: string[]): boolean {
  return includePatterns.some((pattern) => {
    const normalizedPattern = normalizePathForMatch(pattern);
    return (
      matchesAnyGlob(relativePath, [normalizedPattern]) ||
      relativePath === normalizedPattern ||
      relativePath.startsWith(`${normalizedPattern}/`)
    );
  });
}

function getFileKind(relativePath: string): DiscoveredProjectFile["kind"] | undefined {
  if (isSourceFilePath(relativePath)) {
    return "source";
  }

  if (isCssFilePath(relativePath)) {
    return "css";
  }

  if (isHtmlFilePath(relativePath)) {
    return "html";
  }

  return undefined;
}

function compareDiscoveredFiles(left: DiscoveredProjectFile, right: DiscoveredProjectFile): number {
  return left.relativePath.localeCompare(right.relativePath);
}

async function discoverReactSourceIncludePaths(
  rootDir: string,
  excludePatterns: string[],
): Promise<string[]> {
  const reactPackageRoots = await discoverReactPackageRoots(rootDir, excludePatterns);
  const includePaths = new Set<string>();

  for (const packageRoot of reactPackageRoots) {
    for (const candidate of ["src", "app", "client/src"]) {
      const absoluteCandidatePath = path.join(rootDir, packageRoot, candidate);
      if (!(await directoryExists(absoluteCandidatePath))) {
        continue;
      }

      includePaths.add(normalizeRelativePath(path.join(packageRoot, candidate)));
    }
  }

  const sortedIncludePaths = [...includePaths].sort((left, right) => left.localeCompare(right));
  if (sortedIncludePaths.length === 0) {
    throw new Error(
      "No React source roots were discovered automatically. Add React to the relevant package.json files and ensure those projects have a source directory such as src, or configure source.include explicitly.",
    );
  }

  return sortedIncludePaths;
}

async function discoverReactPackageRoots(
  rootDir: string,
  excludePatterns: string[],
): Promise<string[]> {
  const packageRoots = new Set<string>();
  await walkForPackageJson(rootDir, rootDir, excludePatterns, packageRoots);
  return [...packageRoots].sort((left, right) => left.localeCompare(right));
}

async function walkForPackageJson(
  currentDir: string,
  rootDir: string,
  excludePatterns: string[],
  packageRoots: Set<string>,
): Promise<void> {
  const entries = await readdir(currentDir, { withFileTypes: true });

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const absolutePath = path.join(currentDir, entry.name);
    const relativePath = normalizePathForMatch(path.relative(rootDir, absolutePath));

    if (entry.isDirectory()) {
      if (shouldExcludePath(relativePath, excludePatterns)) {
        continue;
      }

      await walkForPackageJson(absolutePath, rootDir, excludePatterns, packageRoots);
      continue;
    }

    if (!entry.isFile() || entry.name !== "package.json") {
      continue;
    }

    if (await isReactPackageJson(absolutePath)) {
      packageRoots.add(normalizeRelativePath(path.dirname(relativePath)));
    }
  }
}

async function isReactPackageJson(packageJsonPath: string): Promise<boolean> {
  let parsedPackageJson: unknown;

  try {
    parsedPackageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as unknown;
  } catch {
    return false;
  }

  if (
    !parsedPackageJson ||
    typeof parsedPackageJson !== "object" ||
    Array.isArray(parsedPackageJson)
  ) {
    return false;
  }

  const packageJson = parsedPackageJson as Record<string, unknown>;
  return ["dependencies", "devDependencies", "peerDependencies"].some((fieldName) =>
    hasReactDependency(packageJson[fieldName]),
  );
}

function hasReactDependency(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return typeof (value as Record<string, unknown>).react === "string";
}

async function directoryExists(directoryPath: string): Promise<boolean> {
  try {
    const fileStats = await stat(directoryPath);
    return fileStats.isDirectory();
  } catch {
    return false;
  }
}

function normalizeRelativePath(value: string): string {
  const normalizedValue = normalizePathForMatch(value);
  return normalizedValue === "." ? "" : normalizedValue.replace(/^\.\//, "");
}

function normalizePathForMatch(value: string): string {
  return value.split(path.sep).join("/");
}

function isSourceFilePath(filePath: string): boolean {
  return new Set([".js", ".jsx", ".ts", ".tsx"]).has(path.extname(filePath).toLowerCase());
}

function isCssFilePath(filePath: string): boolean {
  return path.extname(filePath).toLowerCase() === ".css";
}

function isHtmlFilePath(filePath: string): boolean {
  return path.extname(filePath).toLowerCase() === ".html";
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

function matchesAnyGlob(value: string, patterns: readonly string[]): boolean {
  const normalizedValue = normalizePathForMatch(value);
  return patterns.some((pattern) => globToRegExp(pattern).test(normalizedValue));
}
