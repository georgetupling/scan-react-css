import { normalizeFilePath } from "../shared/pathUtils.js";

export type ResolveSourceSpecifierInput = {
  fromFilePath: string;
  specifier: string;
  knownFilePaths: SourceFilePathLookup;
  includeTypeScriptExtensionAlternates?: boolean;
  workspacePackageEntryPointsByPackageName?: ReadonlyMap<
    string,
    readonly WorkspacePackageEntryPointLike[]
  >;
};

export type SourceFilePathLookup = {
  has(filePath: string): boolean;
};

export type WorkspacePackageEntryPointLike = string | { filePath: string };

export function resolveSourceSpecifier(input: ResolveSourceSpecifierInput): string | undefined {
  if (!input.specifier.startsWith(".")) {
    return resolveWorkspacePackageSpecifier(input.specifier, input);
  }

  return resolveRelativeSourceSpecifier(input);
}

export function getSourceSpecifierCandidatePaths(input: {
  fromFilePath: string;
  specifier: string;
  includeTypeScriptExtensionAlternates?: boolean;
}): string[] {
  const normalizedFromFilePath = normalizeFilePath(input.fromFilePath);
  const fromSegments = normalizedFromFilePath.split("/");
  fromSegments.pop();
  const baseSegments = input.specifier.split("/").filter((segment) => segment.length > 0);
  const candidateBasePath = normalizeSegments([...fromSegments, ...baseSegments]);

  return [
    candidateBasePath,
    ...(input.includeTypeScriptExtensionAlternates
      ? getTypeScriptSourceAlternatesForSpecifier(candidateBasePath)
      : []),
    `${candidateBasePath}.ts`,
    `${candidateBasePath}.tsx`,
    `${candidateBasePath}.js`,
    `${candidateBasePath}.jsx`,
    `${candidateBasePath}/index.ts`,
    `${candidateBasePath}/index.tsx`,
    `${candidateBasePath}/index.js`,
    `${candidateBasePath}/index.jsx`,
  ];
}

function resolveRelativeSourceSpecifier(input: ResolveSourceSpecifierInput): string | undefined {
  return getSourceSpecifierCandidatePaths(input).find((candidatePath) =>
    input.knownFilePaths.has(candidatePath),
  );
}

function resolveWorkspacePackageSpecifier(
  specifier: string,
  input: ResolveSourceSpecifierInput,
): string | undefined {
  const packageName = getPackageNameFromSpecifier(specifier);
  if (!packageName) {
    return undefined;
  }

  const entryPoints = input.workspacePackageEntryPointsByPackageName?.get(packageName) ?? [];
  return entryPoints.length === 1
    ? getWorkspacePackageEntryPointFilePath(entryPoints[0])
    : undefined;
}

function getWorkspacePackageEntryPointFilePath(entryPoint: WorkspacePackageEntryPointLike): string {
  return typeof entryPoint === "string" ? entryPoint : entryPoint.filePath;
}

function getTypeScriptSourceAlternatesForSpecifier(candidateBasePath: string): string[] {
  if (candidateBasePath.endsWith(".js")) {
    return [
      `${candidateBasePath.slice(0, -".js".length)}.ts`,
      `${candidateBasePath.slice(0, -".js".length)}.tsx`,
    ];
  }

  if (candidateBasePath.endsWith(".jsx")) {
    return [`${candidateBasePath.slice(0, -".jsx".length)}.tsx`];
  }

  if (candidateBasePath.endsWith(".mjs") || candidateBasePath.endsWith(".cjs")) {
    return [
      `${candidateBasePath.slice(0, -".mjs".length)}.mts`,
      `${candidateBasePath.slice(0, -".mjs".length)}.cts`,
    ];
  }

  return [];
}

function getPackageNameFromSpecifier(specifier: string): string | undefined {
  if (specifier.startsWith(".") || specifier.startsWith("/") || specifier.startsWith("//")) {
    return undefined;
  }

  const segments = specifier.split("/").filter((segment) => segment.length > 0);
  if (segments.length === 0) {
    return undefined;
  }

  if (segments[0].startsWith("@")) {
    return segments.length >= 2 ? `${segments[0]}/${segments[1]}` : undefined;
  }

  return segments[0];
}

function normalizeSegments(segments: string[]): string {
  const normalized: string[] = [];

  for (const segment of segments) {
    if (segment === ".") {
      continue;
    }

    if (segment === "..") {
      normalized.pop();
      continue;
    }

    normalized.push(segment);
  }

  return normalized.join("/");
}
