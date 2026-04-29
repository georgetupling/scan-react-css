import type { SourceAnchor } from "../../../../types/core.js";

export function createSiteKey(
  kind: string,
  location: SourceAnchor,
  discriminator?: string,
): string {
  return [
    kind,
    location.filePath.replace(/\\/g, "/"),
    location.startLine,
    location.startColumn,
    location.endLine ?? 0,
    location.endColumn ?? 0,
    discriminator ?? "",
  ].join(":");
}
