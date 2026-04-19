import test from "node:test";
import assert from "node:assert/strict";

import {
  analyzeSourceText,
  collectRenderRegionsFromSubtrees,
} from "../../../dist/static-analysis-engine.js";

test("render region collector emits branch-local regions for conditionals", () => {
  const result = analyzeSourceText({
    filePath: "src/App.tsx",
    sourceText: [
      "export function App({ open }: { open: boolean }) {",
      '  return open ? <section className="panel is-open" /> : <section className="panel" />;',
      "}",
    ].join("\n"),
  });

  const regions = collectRenderRegionsFromSubtrees(result.renderSubtrees);
  assert.deepEqual(
    regions.map((region) => ({
      kind: region.kind,
      path: region.path,
    })),
    [
      {
        kind: "subtree-root",
        path: [{ kind: "root" }],
      },
      {
        kind: "conditional-branch",
        path: [{ kind: "root" }, { kind: "conditional-branch", branch: "when-true" }],
      },
      {
        kind: "conditional-branch",
        path: [{ kind: "root" }, { kind: "conditional-branch", branch: "when-false" }],
      },
    ],
  );
});

test("render region collector emits repeated-template regions", () => {
  const result = analyzeSourceText({
    filePath: "src/App.tsx",
    sourceText: [
      "export function App({ items }: { items: string[] }) {",
      '  return <ul className="results">{items.map(() => <li className="result-item" />)}</ul>;',
      "}",
    ].join("\n"),
  });

  const regions = collectRenderRegionsFromSubtrees(result.renderSubtrees);
  assert.deepEqual(
    regions.map((region) => ({
      kind: region.kind,
      path: region.path,
    })),
    [
      {
        kind: "subtree-root",
        path: [{ kind: "root" }],
      },
      {
        kind: "repeated-template",
        path: [
          { kind: "root" },
          { kind: "fragment-child", childIndex: 0 },
          { kind: "repeated-template" },
        ],
      },
    ],
  );
});
