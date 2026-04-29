import path from "node:path";
import { normalizeProjectPath } from "../../../../project/pathUtils.js";
import type { ProjectFileRecord, ScanDiagnostic } from "../../../../project/types.js";
import type { HtmlScriptSourceFact, HtmlStylesheetLinkFact } from "../types.js";

export function resolveLocalHtmlScriptSources(input: {
  rootDir: string;
  htmlScriptSources: HtmlScriptSourceFact[];
  diagnostics: ScanDiagnostic[];
}): HtmlScriptSourceFact[] {
  return input.htmlScriptSources.map((scriptSource) => {
    if (!isLocalSourceHref(scriptSource.src)) {
      return scriptSource;
    }

    const resolvedFilePath = resolveLocalHrefProjectPath({
      htmlFilePath: scriptSource.filePath,
      href: scriptSource.src,
    });
    if (!resolvedFilePath) {
      return scriptSource;
    }

    const absolutePath = path.resolve(input.rootDir, resolvedFilePath);
    if (!isPathInsideRoot(input.rootDir, absolutePath)) {
      input.diagnostics.push({
        code: "loading.html-script-outside-root",
        severity: "warning",
        phase: "loading",
        filePath: scriptSource.filePath,
        message: `HTML script source points outside the scan root and was ignored: ${scriptSource.src}`,
      });
      return scriptSource;
    }

    return {
      ...scriptSource,
      resolvedFilePath,
      appRootPath: inferHtmlScriptAppRootPath({
        htmlFilePath: scriptSource.filePath,
        scriptFilePath: resolvedFilePath,
      }),
    };
  });
}

export function resolveLocalHtmlStylesheetLinks(input: {
  rootDir: string;
  htmlStylesheetLinks: HtmlStylesheetLinkFact[];
  diagnostics: ScanDiagnostic[];
}): HtmlStylesheetLinkFact[] {
  return input.htmlStylesheetLinks.map((stylesheetLink) => {
    if (stylesheetLink.isRemote || !isLocalCssHref(stylesheetLink.href)) {
      return stylesheetLink;
    }

    const resolvedFilePath = resolveLocalHrefProjectPath({
      htmlFilePath: stylesheetLink.filePath,
      href: stylesheetLink.href,
    });
    if (!resolvedFilePath) {
      return stylesheetLink;
    }

    const absolutePath = path.resolve(input.rootDir, resolvedFilePath);
    if (!isPathInsideRoot(input.rootDir, absolutePath)) {
      input.diagnostics.push({
        code: "loading.html-stylesheet-outside-root",
        severity: "warning",
        phase: "loading",
        filePath: stylesheetLink.filePath,
        message: `HTML stylesheet link points outside the scan root and was ignored: ${stylesheetLink.href}`,
      });
      return stylesheetLink;
    }

    return {
      ...stylesheetLink,
      resolvedFilePath,
    };
  });
}

export function collectLinkedCssFiles(input: {
  rootDir: string;
  cssFiles: ProjectFileRecord[];
  htmlStylesheetLinks: HtmlStylesheetLinkFact[];
}): ProjectFileRecord[] {
  const knownCssFilePaths = new Set(input.cssFiles.map((cssFile) => cssFile.filePath));
  const linkedCssFilePaths = [
    ...new Set(
      input.htmlStylesheetLinks
        .map((stylesheetLink) => stylesheetLink.resolvedFilePath)
        .filter((filePath): filePath is string => Boolean(filePath)),
    ),
  ].sort((left, right) => left.localeCompare(right));

  return linkedCssFilePaths
    .filter((filePath) => !knownCssFilePaths.has(filePath))
    .map((filePath) => ({
      filePath,
      absolutePath: path.resolve(input.rootDir, filePath),
    }));
}

function isLocalCssHref(href: string): boolean {
  const hrefPath = stripUrlSuffix(href);
  if (!hrefPath.endsWith(".css")) {
    return false;
  }

  if (hrefPath.startsWith("//")) {
    return false;
  }

  return !/^[a-z][a-z0-9+.-]*:/i.test(hrefPath);
}

function isLocalSourceHref(href: string): boolean {
  const hrefPath = stripUrlSuffix(href);
  if (!/\.[cm]?[jt]sx?$/.test(hrefPath)) {
    return false;
  }

  if (hrefPath.startsWith("//")) {
    return false;
  }

  return !/^[a-z][a-z0-9+.-]*:/i.test(hrefPath);
}

function resolveLocalHrefProjectPath(input: {
  htmlFilePath: string;
  href: string;
}): string | undefined {
  const hrefPath = stripUrlSuffix(input.href).replace(/\\/g, "/");
  if (hrefPath.startsWith("/")) {
    return normalizeProjectPath(hrefPath.replace(/^\/+/, ""));
  }

  const htmlDirectory = path.posix.dirname(input.htmlFilePath.replace(/\\/g, "/"));
  const relativePath = htmlDirectory === "." ? hrefPath : path.posix.join(htmlDirectory, hrefPath);
  return normalizeProjectPath(relativePath);
}

function inferHtmlScriptAppRootPath(input: {
  htmlFilePath: string;
  scriptFilePath: string;
}): string {
  const htmlDirectory = path.posix.dirname(input.htmlFilePath.replace(/\\/g, "/"));
  const scriptDirectory = path.posix.dirname(input.scriptFilePath.replace(/\\/g, "/"));
  const htmlSegments = htmlDirectory === "." ? [] : htmlDirectory.split("/");
  const scriptSegments = scriptDirectory === "." ? [] : scriptDirectory.split("/");
  const commonSegments: string[] = [];

  for (
    let index = 0;
    index < Math.min(htmlSegments.length, scriptSegments.length) &&
    htmlSegments[index] === scriptSegments[index];
    index += 1
  ) {
    commonSegments.push(htmlSegments[index]);
  }

  return commonSegments.join("/") || ".";
}

function stripUrlSuffix(href: string): string {
  return href.split(/[?#]/, 1)[0] ?? href;
}

function isPathInsideRoot(rootDir: string, absolutePath: string): boolean {
  const relativePath = path.relative(rootDir, absolutePath);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}
