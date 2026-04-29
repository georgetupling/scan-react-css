import ts from "typescript";

import { createSiteKey } from "./keys.js";
import { collectReactComponents } from "./collectComponents.js";
import { collectCssModuleNamespaceNames } from "./cssModuleImports.js";
import { tryCreateElementTemplate } from "./elementTemplates.js";
import { tryCreateRenderSite } from "./renderSites.js";
import {
  dedupeClassExpressionSites,
  tryCreateCssModuleClassExpressionSite,
  tryCreateJsxClassExpressionSite,
} from "./classExpressionSites.js";
import {
  compareClassExpressionSites,
  compareComponents,
  compareElementTemplates,
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
  const renderStack: ReactRenderSiteFact[] = [];
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
      }
    }

    const currentComponentKey = componentStack.at(-1);
    const currentParentSiteKey = renderStack.at(-1)?.siteKey;
    const renderSite = tryCreateRenderSite({
      node,
      filePath: input.filePath,
      sourceFile: input.sourceFile,
      ...(currentComponentKey ? { emittingComponentKey: currentComponentKey } : {}),
      ...(currentParentSiteKey ? { parentSiteKey: currentParentSiteKey } : {}),
    });
    let template: ReactElementTemplateFact | undefined;
    if (renderSite) {
      renderSites.push(renderSite);
      renderStack.push(renderSite);

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

    const classSite = tryCreateJsxClassExpressionSite({
      node,
      filePath: input.filePath,
      sourceFile: input.sourceFile,
      ...(renderSite ? { renderSite } : {}),
      ...(template ? { template } : {}),
      ...(currentComponentKey ? { emittingComponentKey: currentComponentKey } : {}),
    });
    if (classSite) {
      classExpressionSites.push(classSite);
    }

    const cssModuleClassSite = tryCreateCssModuleClassExpressionSite({
      node,
      filePath: input.filePath,
      sourceFile: input.sourceFile,
      cssModuleNamespaceNames,
      ...(currentComponentKey ? { emittingComponentKey: currentComponentKey } : {}),
    });
    if (cssModuleClassSite) {
      classExpressionSites.push(cssModuleClassSite);
    }

    ts.forEachChild(node, visit);

    if (renderSite) {
      renderStack.pop();
    }
    if (componentRootSite) {
      renderStack.pop();
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
  };
}
