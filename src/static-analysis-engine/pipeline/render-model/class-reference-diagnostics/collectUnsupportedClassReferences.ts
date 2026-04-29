import ts from "typescript";

import type { RenderNode, RenderSubtree } from "../render-ir/types.js";
import type { UnsupportedClassReferenceDiagnostic } from "./types.js";
import { toSourceAnchor } from "../render-ir/shared/renderIrUtils.js";
import type { SourceAnchor } from "../../../types/core.js";
import type { FactGraphReactRenderSyntaxInputs } from "../../fact-graph/index.js";

export function collectUnsupportedClassReferences(input: {
  parsedFiles: Array<{
    filePath: string;
    parsedSourceFile: ts.SourceFile;
  }>;
  reactRenderSyntax?: FactGraphReactRenderSyntaxInputs;
  renderSubtrees: RenderSubtree[];
  includeTraces?: boolean;
}): UnsupportedClassReferenceDiagnostic[] {
  const includeTraces = input.includeTraces ?? true;
  const modeledClassReferenceKeys = collectModeledClassReferenceKeys(input.renderSubtrees);
  const graphClassReferenceKeys = input.reactRenderSyntax
    ? collectGraphClassReferenceKeys(input.reactRenderSyntax)
    : new Set<string>();
  const diagnostics = [
    ...(input.reactRenderSyntax
      ? collectGraphClassExpressionDiagnostics({
          reactRenderSyntax: input.reactRenderSyntax,
          modeledClassReferenceKeys,
          includeTraces,
        })
      : []),
    ...collectAstClassExpressionDiagnostics({
      parsedFiles: input.parsedFiles,
      modeledClassReferenceKeys,
      ignoredClassReferenceKeys: graphClassReferenceKeys,
      includeTraces,
    }),
  ];

  return diagnostics.sort((left, right) =>
    createAnchorKey(left.sourceAnchor).localeCompare(createAnchorKey(right.sourceAnchor)),
  );
}

function collectGraphClassExpressionDiagnostics(input: {
  reactRenderSyntax: FactGraphReactRenderSyntaxInputs;
  modeledClassReferenceKeys: Set<string>;
  includeTraces: boolean;
}): UnsupportedClassReferenceDiagnostic[] {
  const diagnostics: UnsupportedClassReferenceDiagnostic[] = [];

  for (const site of input.reactRenderSyntax.classExpressionSites) {
    if (site.siteKind !== "jsx-class" && site.siteKind !== "component-prop-class") {
      continue;
    }

    if (input.modeledClassReferenceKeys.has(createAnchorKey(site.sourceAnchor))) {
      continue;
    }

    diagnostics.push(
      createUnsupportedClassReferenceDiagnostic({
        anchor: site.sourceAnchor,
        rawExpressionText: site.rawExpressionText,
        includeTraces: input.includeTraces,
      }),
    );
  }

  return diagnostics;
}

function collectAstClassExpressionDiagnostics(input: {
  parsedFiles: Array<{
    filePath: string;
    parsedSourceFile: ts.SourceFile;
  }>;
  modeledClassReferenceKeys: Set<string>;
  ignoredClassReferenceKeys: Set<string>;
  includeTraces: boolean;
}): UnsupportedClassReferenceDiagnostic[] {
  const diagnostics: UnsupportedClassReferenceDiagnostic[] = [];

  for (const parsedFile of input.parsedFiles) {
    visitJsxClassAttributes(parsedFile.parsedSourceFile, (attribute) => {
      const expression = unwrapJsxAttributeInitializer(attribute.initializer);
      const anchorNode = expression ?? attribute;
      const anchor = toSourceAnchor(anchorNode, parsedFile.parsedSourceFile, parsedFile.filePath);

      if (input.modeledClassReferenceKeys.has(createAnchorKey(anchor))) {
        return;
      }

      if (input.ignoredClassReferenceKeys.has(createAnchorKey(anchor))) {
        return;
      }

      diagnostics.push(
        createUnsupportedClassReferenceDiagnostic({
          anchor,
          rawExpressionText: anchorNode.getText(parsedFile.parsedSourceFile),
          includeTraces: input.includeTraces,
        }),
      );
    });
  }

  return diagnostics;
}

function collectGraphClassReferenceKeys(
  reactRenderSyntax: FactGraphReactRenderSyntaxInputs,
): Set<string> {
  const keys = new Set<string>();
  for (const site of reactRenderSyntax.classExpressionSites) {
    if (site.siteKind !== "jsx-class" && site.siteKind !== "component-prop-class") {
      continue;
    }

    keys.add(createAnchorKey(site.sourceAnchor));
  }
  return keys;
}

function createUnsupportedClassReferenceDiagnostic(input: {
  anchor: SourceAnchor;
  rawExpressionText: string;
  includeTraces: boolean;
}): UnsupportedClassReferenceDiagnostic {
  return {
    sourceAnchor: input.anchor,
    rawExpressionText: input.rawExpressionText,
    reason: "raw-jsx-class-not-modeled",
    traces: input.includeTraces
      ? [
          {
            traceId: `diagnostic:class-reference:unsupported:${input.anchor.filePath}:${input.anchor.startLine}:${input.anchor.startColumn}`,
            category: "render-expansion",
            summary:
              "raw JSX className syntax was present in the source file but was not represented in the render IR",
            anchor: input.anchor,
            children: [],
            metadata: {
              reason: "raw-jsx-class-not-modeled",
              rawExpressionText: input.rawExpressionText,
            },
          },
        ]
      : [],
  };
}

function collectModeledClassReferenceKeys(renderSubtrees: RenderSubtree[]): Set<string> {
  const keys = new Set<string>();

  for (const renderSubtree of renderSubtrees) {
    visitRenderNode(renderSubtree.root, (node) => {
      if ((node.kind === "element" || node.kind === "component-reference") && node.className) {
        keys.add(createAnchorKey(node.className.sourceAnchor));
      }
    });
  }

  return keys;
}

function visitRenderNode(node: RenderNode, visit: (node: RenderNode) => void): void {
  visit(node);

  if (node.kind === "element" || node.kind === "fragment") {
    for (const child of node.children) {
      visitRenderNode(child, visit);
    }
    return;
  }

  if (node.kind === "conditional") {
    visitRenderNode(node.whenTrue, visit);
    visitRenderNode(node.whenFalse, visit);
    return;
  }

  if (node.kind === "repeated-region") {
    visitRenderNode(node.template, visit);
  }
}

function visitJsxClassAttributes(node: ts.Node, visit: (attribute: ts.JsxAttribute) => void): void {
  if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name) && node.name.text === "className") {
    visit(node);
  }

  ts.forEachChild(node, (child) => visitJsxClassAttributes(child, visit));
}

function unwrapJsxAttributeInitializer(
  initializer: ts.JsxAttribute["initializer"],
): ts.Expression | undefined {
  if (!initializer) {
    return undefined;
  }

  if (ts.isStringLiteral(initializer) || ts.isNoSubstitutionTemplateLiteral(initializer)) {
    return initializer;
  }

  if (ts.isJsxExpression(initializer)) {
    return initializer.expression ?? undefined;
  }

  if (
    ts.isJsxElement(initializer) ||
    ts.isJsxSelfClosingElement(initializer) ||
    ts.isJsxFragment(initializer)
  ) {
    return initializer;
  }

  return undefined;
}

function createAnchorKey(anchor: SourceAnchor): string {
  return [
    normalizeProjectPath(anchor.filePath),
    anchor.startLine,
    anchor.startColumn,
    anchor.endLine ?? "",
    anchor.endColumn ?? "",
  ].join(":");
}

function normalizeProjectPath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}
