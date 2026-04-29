import type { SourceAnchor } from "../../../../types/core.js";

export type SourceReactSyntaxFacts = {
  components: ReactComponentDeclarationFact[];
  renderSites: ReactRenderSiteFact[];
  elementTemplates: ReactElementTemplateFact[];
  classExpressionSites: ReactClassExpressionSiteFact[];
};

export type ReactComponentDeclarationFact = {
  componentKey: string;
  componentName: string;
  filePath: string;
  exported: boolean;
  declarationKind: "function" | "variable" | "class";
  evidence: string;
  location: SourceAnchor;
};

export type ReactRenderSiteFact = {
  siteKey: string;
  kind:
    | "component-root"
    | "jsx-element"
    | "component-reference"
    | "jsx-fragment"
    | "conditional"
    | "helper-return";
  filePath: string;
  location: SourceAnchor;
  emittingComponentKey?: string;
  placementComponentKey?: string;
  parentSiteKey?: string;
  elementTemplateKey?: string;
};

export type ReactElementTemplateFact = {
  templateKey: string;
  kind: "intrinsic" | "component-candidate" | "fragment";
  filePath: string;
  location: SourceAnchor;
  name: string;
  renderSiteKey: string;
  emittingComponentKey?: string;
  placementComponentKey?: string;
};

export type ReactClassExpressionSiteFact = {
  siteKey: string;
  kind: "jsx-class" | "component-prop-class" | "css-module-member" | "runtime-dom-class";
  filePath: string;
  location: SourceAnchor;
  rawExpressionText: string;
  emittingComponentKey?: string;
  placementComponentKey?: string;
  renderSiteKey?: string;
  elementTemplateKey?: string;
};
