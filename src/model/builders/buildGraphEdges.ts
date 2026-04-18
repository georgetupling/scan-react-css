import type {
  CssFileNode,
  ExternalCssResourceNode,
  ProjectGraphEdge,
  SourceFileNode,
} from "../types.js";

export function buildGraphEdges(
  sourceFiles: SourceFileNode[],
  cssFiles: CssFileNode[],
  externalCssResources: ExternalCssResourceNode[],
): ProjectGraphEdge[] {
  const edges: ProjectGraphEdge[] = [];

  for (const sourceFile of sourceFiles) {
    for (const sourceImport of sourceFile.sourceImports) {
      edges.push({
        type: "source-import",
        from: sourceFile.path,
        to: sourceImport.resolvedPath ?? sourceImport.specifier,
      });
    }

    for (const renderedComponent of sourceFile.renderedComponents) {
      edges.push({
        type: "render",
        from: sourceFile.path,
        to: renderedComponent.resolvedPath,
        metadata: {
          componentName: renderedComponent.componentName,
          line: renderedComponent.line,
          column: renderedComponent.column,
        },
      });
    }

    for (const cssImport of sourceFile.cssImports) {
      edges.push({
        type: "css-import",
        from: sourceFile.path,
        to: cssImport.resolvedPath ?? cssImport.specifier,
      });
    }

    for (const externalImport of sourceFile.externalCssImports) {
      edges.push({
        type: "external-css-import",
        from: sourceFile.path,
        to: externalImport.specifier,
      });
    }

    for (const cssModuleImport of sourceFile.cssModuleImports) {
      edges.push({
        type: "css-module-import",
        from: sourceFile.path,
        to: cssModuleImport.resolvedPath ?? cssModuleImport.specifier,
        metadata: {
          localName: cssModuleImport.localName,
        },
      });
    }

    for (const classReference of sourceFile.classReferences) {
      if (!classReference.className) {
        continue;
      }

      edges.push({
        type: "class-reference",
        from: sourceFile.path,
        to: classReference.className,
        metadata: {
          kind: classReference.kind,
          confidence: classReference.confidence,
        },
      });
    }
  }

  for (const cssFile of cssFiles) {
    for (const definition of cssFile.classDefinitions) {
      edges.push({
        type: "class-definition",
        from: cssFile.path,
        to: definition.className,
        metadata: {
          selector: definition.selector,
          ownership: cssFile.ownership,
          category: cssFile.category,
        },
      });
    }
  }

  for (const externalCssResource of externalCssResources) {
    for (const importedBy of externalCssResource.importedBy) {
      edges.push({
        type: "external-css-import",
        from: importedBy,
        to: externalCssResource.specifier,
      });
    }

    for (const definition of externalCssResource.classDefinitions) {
      edges.push({
        type: "class-definition",
        from: externalCssResource.resolvedPath,
        to: definition.className,
        metadata: {
          selector: definition.selector,
          ownership: "external",
          category: "external",
          externalSpecifier: externalCssResource.specifier,
        },
      });
    }
  }

  return edges.sort(compareGraphEdges);
}

function compareGraphEdges(left: ProjectGraphEdge, right: ProjectGraphEdge): number {
  if (left.type !== right.type) {
    return left.type.localeCompare(right.type);
  }

  if (left.from !== right.from) {
    return left.from.localeCompare(right.from);
  }

  return left.to.localeCompare(right.to);
}
