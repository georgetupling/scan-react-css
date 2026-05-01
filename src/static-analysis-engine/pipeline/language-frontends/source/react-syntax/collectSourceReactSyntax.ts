import ts from "typescript";

import { createSiteKey } from "./keys.js";
import { collectReactComponents } from "./collectComponents.js";
import { collectCssModuleNamespaceNames } from "./cssModuleImports.js";
import { tryCreateElementTemplate } from "./elementTemplates.js";
import { tryCreateRenderSite } from "./renderSites.js";
import {
  dedupeExpressionSyntaxFacts,
  collectExpressionSyntaxForNode,
  type SourceExpressionSyntaxFact,
} from "../expression-syntax/index.js";
import {
  collectComponentBindingFacts,
  collectTopLevelHelperBindingFacts,
  isLikelyReactComponentName,
  mergeReactBindingFacts,
} from "./bindingFacts.js";
import {
  dedupeClassExpressionSites,
  tryCreateCloneElementClassExpressionSite,
  tryCreateCssModuleClassExpressionSite,
  createJsxClassExpressionSites,
} from "./classExpressionSites.js";
import {
  compareClassExpressionSites,
  compareComponentPropBindings,
  compareComponents,
  compareElementTemplates,
  compareHelperDefinitions,
  compareLocalValueBindings,
  compareRenderSites,
} from "./sortReactSyntaxFacts.js";
import type { SourceModuleSyntaxFacts } from "../module-syntax/index.js";
import type {
  ReactClassExpressionSiteFact,
  ReactElementTemplateFact,
  ReactRenderSiteFact,
  SourceReactSyntaxFacts,
} from "./types.js";

export function collectSourceReactSyntax(input: {
  filePath: string;
  sourceFile: ts.SourceFile;
  moduleSyntax: SourceModuleSyntaxFacts;
}): SourceReactSyntaxFacts {
  const { components, componentKeyByFunction } = collectReactComponents({
    filePath: input.filePath,
    sourceFile: input.sourceFile,
  });
  const cssModuleNamespaceNames = collectCssModuleNamespaceNames(input.moduleSyntax);
  const renderSites: ReactRenderSiteFact[] = [];
  const elementTemplates: ReactElementTemplateFact[] = [];
  const classExpressionSites: ReactClassExpressionSiteFact[] = [];
  const expressionSyntax: SourceExpressionSyntaxFact[] = [];
  const componentByKey = new Map(
    components.map((component) => [component.componentKey, component]),
  );
  const bindingFacts = mergeReactBindingFacts([
    collectTopLevelHelperBindingFacts({
      filePath: input.filePath,
      sourceFile: input.sourceFile,
      componentKeyByFunction,
    }),
    ...[...componentKeyByFunction.entries()].flatMap(([functionLikeNode, componentKey]) => {
      if (
        !ts.isFunctionDeclaration(functionLikeNode) &&
        !ts.isArrowFunction(functionLikeNode) &&
        !ts.isFunctionExpression(functionLikeNode)
      ) {
        return [];
      }

      const component = componentByKey.get(componentKey);
      if (!component || !isLikelyReactComponentName(component.componentName)) {
        return [];
      }

      return [
        collectComponentBindingFacts({
          componentKey,
          filePath: input.filePath,
          sourceFile: input.sourceFile,
          functionLikeNode,
        }),
      ];
    }),
  ]);
  const renderStack: ReactRenderSiteFact[] = [];
  const renderNodeStack: ts.Node[] = [];
  const componentStack: string[] = [];

  function visit(node: ts.Node): void {
    const componentKey = componentKeyByFunction.get(node);
    let componentRootSite: ReactRenderSiteFact | undefined;
    if (componentKey) {
      componentStack.push(componentKey);
      const component = components.find((candidate) => candidate.componentKey === componentKey);
      if (component) {
        componentRootSite = {
          siteKey: createSiteKey("component-root", component.location, component.componentKey),
          kind: "component-root",
          filePath: input.filePath,
          location: component.location,
          emittingComponentKey: component.componentKey,
          placementComponentKey: component.componentKey,
        };
        renderSites.push(componentRootSite);
        renderStack.push(componentRootSite);
        renderNodeStack.push(node);
      }
    }

    const currentComponentKey = componentStack.at(-1);
    const currentParentSiteKey = renderStack.at(-1)?.siteKey;
    const currentParentRenderNode = renderNodeStack.at(-1);
    const renderSite = tryCreateRenderSite({
      node,
      filePath: input.filePath,
      sourceFile: input.sourceFile,
      ...(currentComponentKey ? { emittingComponentKey: currentComponentKey } : {}),
      ...(currentParentSiteKey ? { parentSiteKey: currentParentSiteKey } : {}),
    });
    let template: ReactElementTemplateFact | undefined;
    if (renderSite) {
      if (currentParentSiteKey && currentParentRenderNode) {
        renderSite.parentRenderRelation = classifyParentRenderRelation({
          node,
          parentRenderNode: currentParentRenderNode,
        });
        if (renderSite.parentRenderRelation === "jsx-attribute-expression") {
          const parentRenderAttributeName = getContainingJsxAttributeName({
            node,
            parentRenderNode: currentParentRenderNode,
          });
          if (parentRenderAttributeName) {
            renderSite.parentRenderAttributeName = parentRenderAttributeName;
          }
        }
      }
      renderSites.push(renderSite);
      renderStack.push(renderSite);
      renderNodeStack.push(node);
      if (renderSite.kind === "conditional" && ts.isConditionalExpression(node)) {
        const conditionSyntax = collectExpressionSyntaxForNode({
          node: node.condition,
          filePath: input.filePath,
          sourceFile: input.sourceFile,
        });
        expressionSyntax.push(...conditionSyntax.expressions);
        renderSite.conditionExpressionId = conditionSyntax.rootExpressionId;
        renderSite.conditionSourceText = node.condition.getText(input.sourceFile);
      }

      template = tryCreateElementTemplate({
        node,
        filePath: input.filePath,
        renderSite,
      });
      if (template) {
        elementTemplates.push(template);
        renderSite.elementTemplateKey = template.templateKey;
      }
    }

    const jsxClassSites = createJsxClassExpressionSites({
      node,
      filePath: input.filePath,
      sourceFile: input.sourceFile,
      ...(renderSite ? { renderSite } : {}),
      ...(template ? { template } : {}),
      ...(currentComponentKey ? { emittingComponentKey: currentComponentKey } : {}),
    });
    for (const classSite of jsxClassSites) {
      classExpressionSites.push(classSite.site);
      expressionSyntax.push(...classSite.expressionSyntax);
    }

    const cssModuleClassSite = tryCreateCssModuleClassExpressionSite({
      node,
      filePath: input.filePath,
      sourceFile: input.sourceFile,
      cssModuleNamespaceNames,
      ...(currentComponentKey ? { emittingComponentKey: currentComponentKey } : {}),
    });
    if (cssModuleClassSite) {
      classExpressionSites.push(cssModuleClassSite.site);
      expressionSyntax.push(...cssModuleClassSite.expressionSyntax);
    }

    const cloneElementClassSite = tryCreateCloneElementClassExpressionSite({
      node,
      filePath: input.filePath,
      sourceFile: input.sourceFile,
      ...(currentComponentKey ? { emittingComponentKey: currentComponentKey } : {}),
    });
    if (cloneElementClassSite) {
      classExpressionSites.push(cloneElementClassSite.site);
      expressionSyntax.push(...cloneElementClassSite.expressionSyntax);
    }

    ts.forEachChild(node, visit);

    if (renderSite) {
      renderStack.pop();
      renderNodeStack.pop();
    }
    if (componentRootSite) {
      renderStack.pop();
      renderNodeStack.pop();
    }
    if (componentKey) {
      componentStack.pop();
    }
  }

  visit(input.sourceFile);

  return {
    components: components.sort(compareComponents),
    renderSites: renderSites.sort(compareRenderSites),
    elementTemplates: elementTemplates.sort(compareElementTemplates),
    classExpressionSites: dedupeClassExpressionSites(classExpressionSites).sort(
      compareClassExpressionSites,
    ),
    componentPropBindings: bindingFacts.componentPropBindings.sort(compareComponentPropBindings),
    localValueBindings: bindingFacts.localValueBindings.sort(compareLocalValueBindings),
    helperDefinitions: bindingFacts.helperDefinitions.sort(compareHelperDefinitions),
    expressionSyntax: dedupeExpressionSyntaxFacts([
      ...expressionSyntax,
      ...bindingFacts.expressionSyntax,
    ]),
  };
}

function classifyParentRenderRelation(input: {
  node: ts.Node;
  parentRenderNode: ts.Node;
}): NonNullable<ReactRenderSiteFact["parentRenderRelation"]> {
  if (isNestedInJsxAttribute(input.node, input.parentRenderNode)) {
    return "jsx-attribute-expression";
  }
  if (isNestedInJsxChildren(input.node, input.parentRenderNode)) {
    return "jsx-child";
  }
  return "nested-render-expression";
}

function isNestedInJsxAttribute(node: ts.Node, parentRenderNode: ts.Node): boolean {
  let current: ts.Node | undefined = node.parent;
  while (current && current !== parentRenderNode) {
    if (ts.isJsxAttribute(current) || ts.isJsxSpreadAttribute(current)) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

function getContainingJsxAttributeName(input: {
  node: ts.Node;
  parentRenderNode: ts.Node;
}): string | undefined {
  let current: ts.Node | undefined = input.node.parent;
  while (current && current !== input.parentRenderNode) {
    if (ts.isJsxAttribute(current)) {
      return ts.isIdentifier(current.name) ? current.name.text : undefined;
    }
    current = current.parent;
  }
  return undefined;
}

function isNestedInJsxChildren(node: ts.Node, parentRenderNode: ts.Node): boolean {
  if (!ts.isJsxElement(parentRenderNode) && !ts.isJsxFragment(parentRenderNode)) {
    return false;
  }

  let directChild: ts.Node = node;
  while (directChild.parent && directChild.parent !== parentRenderNode) {
    directChild = directChild.parent;
  }

  return (
    directChild.parent === parentRenderNode &&
    parentRenderNode.children.some((child) => child === directChild)
  );
}
