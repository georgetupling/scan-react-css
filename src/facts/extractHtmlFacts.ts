import { readFile } from "node:fs/promises";
import type { DiscoveredProjectFile } from "../files/types.js";
import type { HtmlFileFact } from "./types.js";

const LINK_TAG_PATTERN = /<link\b[^>]*>/gi;
const ATTRIBUTE_PATTERN = /([^\s=/>]+)\s*=\s*("([^"]*)"|'([^']*)')/gi;

export async function extractHtmlFileFacts(htmlFile: DiscoveredProjectFile): Promise<HtmlFileFact> {
  const content = await readFile(htmlFile.absolutePath, "utf8");
  const stylesheetLinks = [];
  let linkMatch: RegExpExecArray | null;

  while ((linkMatch = LINK_TAG_PATTERN.exec(content)) !== null) {
    const attributes = extractAttributes(linkMatch[0]);
    const rel = attributes.rel?.toLowerCase() ?? "";
    const href = attributes.href;

    if (!href || !rel.includes("stylesheet") || !looksLikeCssHref(href)) {
      continue;
    }

    stylesheetLinks.push({
      href,
      isRemote: isRemoteHref(href),
    });
  }

  return {
    filePath: htmlFile.relativePath,
    stylesheetLinks: stylesheetLinks.sort((left, right) => left.href.localeCompare(right.href)),
  };
}

function extractAttributes(tagContent: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  let attributeMatch: RegExpExecArray | null;

  ATTRIBUTE_PATTERN.lastIndex = 0;

  while ((attributeMatch = ATTRIBUTE_PATTERN.exec(tagContent)) !== null) {
    const attributeName = attributeMatch[1].toLowerCase();
    const attributeValue = attributeMatch[3] ?? attributeMatch[4] ?? "";
    attributes[attributeName] = attributeValue;
  }

  return attributes;
}

function looksLikeCssHref(href: string): boolean {
  return /\.css(?:[?#].*)?$/i.test(href);
}

function isRemoteHref(href: string): boolean {
  return /^https?:\/\//i.test(href) || href.startsWith("//");
}
