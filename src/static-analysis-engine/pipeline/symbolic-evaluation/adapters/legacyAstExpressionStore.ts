import ts from "typescript";
import type { SourceAnchor } from "../../../types/core.js";
import type { ClassExpressionSiteNode } from "../../fact-graph/index.js";

export type LegacyParsedProjectFile = {
  filePath: string;
  parsedSourceFile: ts.SourceFile;
};

export type LegacyAstExpressionMatch = {
  expression: ts.Expression;
  parsedSourceFile: ts.SourceFile;
  rawExpressionText: string;
};

export type LegacyAstExpressionStore = {
  getExpressionForSite(site: ClassExpressionSiteNode): LegacyAstExpressionMatch | undefined;
};

export function createLegacyAstExpressionStore(input: {
  parsedFiles: LegacyParsedProjectFile[];
}): LegacyAstExpressionStore {
  const expressionByFilePathAndAnchor = new Map<string, LegacyAstExpressionMatch>();

  for (const parsedFile of input.parsedFiles) {
    collectExpressionMatches(parsedFile, expressionByFilePathAndAnchor);
  }

  return {
    getExpressionForSite(site) {
      return expressionByFilePathAndAnchor.get(createExpressionAnchorKey(site.location));
    },
  };
}

function collectExpressionMatches(
  parsedFile: LegacyParsedProjectFile,
  expressionByFilePathAndAnchor: Map<string, LegacyAstExpressionMatch>,
): void {
  function visit(node: ts.Node): void {
    if (ts.isExpression(node)) {
      const location = toSourceAnchor(node, parsedFile.parsedSourceFile, parsedFile.filePath);
      const key = createExpressionAnchorKey(location);

      if (!expressionByFilePathAndAnchor.has(key)) {
        expressionByFilePathAndAnchor.set(key, {
          expression: node,
          parsedSourceFile: parsedFile.parsedSourceFile,
          rawExpressionText: node.getText(parsedFile.parsedSourceFile),
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(parsedFile.parsedSourceFile);
}

function createExpressionAnchorKey(anchor: SourceAnchor): string {
  return [
    anchor.filePath,
    anchor.startLine,
    anchor.startColumn,
    anchor.endLine ?? 0,
    anchor.endColumn ?? 0,
  ].join("\0");
}

function toSourceAnchor(node: ts.Node, sourceFile: ts.SourceFile, filePath: string): SourceAnchor {
  const start = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile));
  const end = ts.getLineAndCharacterOfPosition(sourceFile, node.getEnd());

  return {
    filePath,
    startLine: start.line + 1,
    startColumn: start.character + 1,
    endLine: end.line + 1,
    endColumn: end.character + 1,
  };
}
