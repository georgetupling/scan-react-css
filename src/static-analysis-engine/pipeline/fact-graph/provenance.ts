import type { FactProvenance } from "./types.js";

export function workspaceFileProvenance(input: {
  filePath?: string;
  summary: string;
}): FactProvenance[] {
  return [
    {
      stage: "workspace-discovery",
      filePath: input.filePath,
      summary: input.summary,
    },
  ];
}

export function frontendFileProvenance(input: {
  filePath: string;
  summary: string;
}): FactProvenance[] {
  return [
    {
      stage: "language-frontends",
      filePath: input.filePath,
      summary: input.summary,
    },
  ];
}

export function factGraphProvenance(summary: string): FactProvenance[] {
  return [
    {
      stage: "fact-graph",
      summary,
    },
  ];
}
