export {
  collectExpressionSyntaxForNode,
  dedupeExpressionSyntaxFacts,
  sortExpressionSyntaxFacts,
} from "./collectExpressionSyntax.js";
export { createExpressionSyntaxId } from "./ids.js";
export type { CollectedExpressionSyntax } from "./collectExpressionSyntax.js";
export type {
  SourceArrayLiteralExpressionSyntax,
  SourceBinaryExpressionSyntax,
  SourceBooleanLiteralExpressionSyntax,
  SourceCallExpressionSyntax,
  SourceConditionalExpressionSyntax,
  SourceElementAccessExpressionSyntax,
  SourceExpressionSyntaxBase,
  SourceExpressionSyntaxFact,
  SourceIdentifierExpressionSyntax,
  SourceMemberAccessExpressionSyntax,
  SourceNullishLiteralExpressionSyntax,
  SourceNumericLiteralExpressionSyntax,
  SourceObjectExpressionProperty,
  SourceObjectLiteralExpressionSyntax,
  SourcePrefixUnaryExpressionSyntax,
  SourceStringLiteralExpressionSyntax,
  SourceTemplateExpressionSpan,
  SourceTemplateExpressionSyntax,
  SourceUnsupportedExpressionSyntax,
  SourceWrapperExpressionSyntax,
} from "./types.js";
