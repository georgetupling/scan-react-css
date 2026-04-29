import { createSiteKey } from "../react-syntax/keys.js";
import type { SourceAnchor } from "../../../../types/core.js";

export function createExpressionSyntaxId(input: {
  location: SourceAnchor;
  discriminator?: string;
}): string {
  return createSiteKey("expression-syntax", input.location, input.discriminator);
}
