export type ReachabilityAvailability = "definite" | "possible" | "unknown" | "unavailable";

export type ReachabilityDerivation =
  | {
      kind: "source-file-direct-import";
    }
  | {
      kind: "whole-component-direct-import";
    }
  | {
      kind: "whole-component-child-availability";
      toComponentName: string;
      toFilePath?: string;
    }
  | {
      kind: "whole-component-all-known-renderers-definite";
    }
  | {
      kind: "whole-component-at-least-one-renderer";
    }
  | {
      kind: "whole-component-only-possible-renderers";
    }
  | {
      kind: "placement-derived-region";
      toComponentName: string;
      toFilePath?: string;
      renderPath: "definite" | "possible";
    };

export type StylesheetReachabilityContext =
  | {
      kind: "source-file";
      filePath: string;
    }
  | {
      kind: "component";
      filePath: string;
      componentName: string;
    }
  | {
      kind: "render-subtree-root";
      filePath: string;
      componentName?: string;
      rootAnchor: {
        startLine: number;
        startColumn: number;
        endLine?: number;
        endColumn?: number;
      };
    }
  | {
      kind: "render-region";
      filePath: string;
      componentName?: string;
      regionKind: import("../render-ir/types.js").RenderRegionKind;
      path: import("../render-ir/types.js").RenderRegionPathSegment[];
      sourceAnchor: {
        startLine: number;
        startColumn: number;
        endLine?: number;
        endColumn?: number;
      };
    };

export type StylesheetReachabilityContextRecord = {
  context: StylesheetReachabilityContext;
  availability: ReachabilityAvailability;
  reasons: string[];
  derivations: ReachabilityDerivation[];
};

export type StylesheetReachabilityRecord = {
  cssFilePath?: string;
  availability: ReachabilityAvailability;
  contexts: StylesheetReachabilityContextRecord[];
  reasons: string[];
};

export type ReachabilitySummary = {
  stylesheets: StylesheetReachabilityRecord[];
};
