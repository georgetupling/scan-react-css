import assert from "node:assert/strict";
import test from "node:test";

import { buildFactGraph } from "../../dist/static-analysis-engine/pipeline/fact-graph/buildFactGraph.js";
import { buildLanguageFrontends } from "../../dist/static-analysis-engine/pipeline/language-frontends/buildLanguageFrontends.js";
import { buildProjectSnapshot } from "../../dist/static-analysis-engine/pipeline/workspace-discovery/buildProjectSnapshot.js";
import { TestProjectBuilder } from "../support/TestProjectBuilder.js";

test("fact graph builds file, module, stylesheet, and origin facts without changing consumers", async () => {
  const project = await new TestProjectBuilder()
    .withSourceFile(
      "src/App.tsx",
      'import "./app.css";\nexport function App() { return <main className="app" />; }\n',
    )
    .withCssFile("src/app.css", ".app { display: block; }\n")
    .withFile("public/index.html", '<script type="module" src="../src/App.tsx"></script>\n')
    .build();

  try {
    const snapshot = await buildProjectSnapshot({
      scanInput: {
        rootDir: project.rootDir,
        sourceFilePaths: ["src/App.tsx"],
        cssFilePaths: ["src/app.css"],
        htmlFilePaths: ["public/index.html"],
      },
      runStage: async (_stage, _message, run) => run(),
    });
    const frontends = buildLanguageFrontends({ snapshot });
    const result = buildFactGraph({ snapshot, frontends });

    assert.deepEqual(
      result.graph.nodes.files.map((node) => ({
        id: node.id,
        filePath: node.filePath,
        fileKind: node.fileKind,
      })),
      [
        {
          id: "file:public/index.html",
          filePath: "public/index.html",
          fileKind: "html",
        },
        {
          id: "file:src/app.css",
          filePath: "src/app.css",
          fileKind: "stylesheet",
        },
        {
          id: "file:src/App.tsx",
          filePath: "src/App.tsx",
          fileKind: "source",
        },
      ],
    );
    assert.deepEqual(
      result.graph.nodes.modules.map((node) => ({
        id: node.id,
        filePath: node.filePath,
        languageKind: node.languageKind,
      })),
      [
        {
          id: "module:src/App.tsx",
          filePath: "src/App.tsx",
          languageKind: "tsx",
        },
      ],
    );
    assert.deepEqual(
      result.graph.nodes.stylesheets.map((node) => ({
        id: node.id,
        filePath: node.filePath,
        cssKind: node.cssKind,
        origin: node.origin,
      })),
      [
        {
          id: "stylesheet:src/app.css",
          filePath: "src/app.css",
          cssKind: "global-css",
          origin: "project",
        },
      ],
    );
    assert.deepEqual(
      result.graph.edges.originatesFromFile.map((edge) => ({
        id: edge.id,
        from: edge.from,
        to: edge.to,
      })),
      [
        {
          id: "originates-from-file:module:src/App.tsx->file:src/App.tsx",
          from: "module:src/App.tsx",
          to: "file:src/App.tsx",
        },
        {
          id: "originates-from-file:stylesheet:src/app.css->file:src/app.css",
          from: "stylesheet:src/app.css",
          to: "file:src/app.css",
        },
      ],
    );
    assert.equal(
      result.graph.indexes.moduleNodeIdByFilePath.get("src/App.tsx"),
      "module:src/App.tsx",
    );
    assert.equal(
      result.graph.indexes.stylesheetNodeIdByFilePath.get("src/app.css"),
      "stylesheet:src/app.css",
    );
    assert.deepEqual(result.graph.diagnostics, []);
  } finally {
    await project.cleanup();
  }
});

test("fact graph reports duplicate graph ids", async () => {
  const project = await new TestProjectBuilder()
    .withSourceFile("src/App.tsx", "export function App() { return null; }\n")
    .build();

  try {
    const snapshot = await buildProjectSnapshot({
      scanInput: {
        rootDir: project.rootDir,
        sourceFilePaths: ["src/App.tsx"],
      },
      runStage: async (_stage, _message, run) => run(),
    });
    const frontends = buildLanguageFrontends({ snapshot });
    const duplicatedFrontends = {
      ...frontends,
      source: {
        files: [frontends.source.files[0], frontends.source.files[0]],
        filesByPath: frontends.source.filesByPath,
      },
    };
    const result = buildFactGraph({
      snapshot,
      frontends: duplicatedFrontends,
    });

    assert.deepEqual(
      result.graph.diagnostics.map((diagnostic) => ({
        severity: diagnostic.severity,
        code: diagnostic.code,
        message: diagnostic.message,
      })),
      [
        {
          severity: "error",
          code: "duplicate-graph-id",
          message: "Duplicate fact graph node id: module:src/App.tsx",
        },
        {
          severity: "error",
          code: "duplicate-graph-id",
          message:
            "Duplicate fact graph edge id: originates-from-file:module:src/App.tsx->file:src/App.tsx",
        },
      ],
    );
  } finally {
    await project.cleanup();
  }
});
