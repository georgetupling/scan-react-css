import assert from "node:assert/strict";
import test from "node:test";

import ts from "typescript";

import { buildModuleFacts } from "../../dist/static-analysis-engine/pipeline/module-facts/buildModuleFacts.js";
import {
  getAllResolvedModuleFacts,
  getResolvedModuleFacts,
} from "../../dist/static-analysis-engine.js";

test("module facts expose normalized per-file imports, exports, and top-level bindings", () => {
  const moduleFacts = buildModuleFacts({
    parsedFiles: [
      sourceFile(
        "src/App.tsx",
        `
          import { themeName } from "./theme.ts";
          import styles from "./App.module.css";
          import "./reset.css";

          export { themeName as appThemeName } from "./theme.ts";
          export const App = () => <div className={styles.root}>{themeName}</div>;
        `,
      ),
      sourceFile("src/theme.ts", 'export const themeName = "light";'),
    ],
    stylesheetFilePaths: ["src/App.module.css", "src/reset.css"],
  });

  const appFacts = getResolvedModuleFacts({
    moduleFacts,
    filePath: "src/App.tsx",
  });
  assert.ok(appFacts);
  assert.equal(appFacts.filePath, "src/App.tsx");
  assert.equal(appFacts.moduleId, "module:src/App.tsx");
  assert.equal(appFacts.moduleKind, "source");
  assert.deepEqual(
    appFacts.imports.map((importFact) => ({
      specifier: importFact.specifier,
      importKind: importFact.importKind,
      cssSemantics: importFact.cssSemantics,
      importedBindings: importFact.importedBindings,
      resolution: importFact.resolution,
    })),
    [
      {
        specifier: "./App.module.css",
        importKind: "css",
        cssSemantics: "module",
        importedBindings: [
          {
            importedName: "default",
            localName: "styles",
            bindingKind: "default",
            typeOnly: false,
            localBindingId: "symbol:module:src/App.tsx:styles",
          },
        ],
        resolution: {
          status: "resolved",
          resolvedFilePath: "src/App.module.css",
          resolvedModuleId: "module:src/App.module.css",
          confidence: "exact",
        },
      },
      {
        specifier: "./reset.css",
        importKind: "css",
        cssSemantics: "global",
        importedBindings: [],
        resolution: {
          status: "resolved",
          resolvedFilePath: "src/reset.css",
          resolvedModuleId: "module:src/reset.css",
          confidence: "exact",
        },
      },
      {
        specifier: "./theme.ts",
        importKind: "source",
        cssSemantics: undefined,
        importedBindings: [
          {
            importedName: "themeName",
            localName: "themeName",
            bindingKind: "named",
            typeOnly: false,
            localBindingId: "symbol:module:src/App.tsx:themeName",
          },
        ],
        resolution: {
          status: "resolved",
          resolvedFilePath: "src/theme.ts",
          resolvedModuleId: "module:src/theme.ts",
          confidence: "exact",
        },
      },
    ],
  );
  assert.deepEqual(
    appFacts.exports.map((exportFact) => ({
      exportedName: exportFact.exportedName,
      sourceExportedName: exportFact.sourceExportedName,
      localName: exportFact.localName,
      localBindingId: exportFact.localBindingId,
      exportKind: exportFact.exportKind,
      declarationKind: exportFact.declarationKind,
      typeOnly: exportFact.typeOnly,
      reexportKind: exportFact.reexportKind,
      reexport: exportFact.reexport,
    })),
    [
      {
        exportedName: "App",
        sourceExportedName: "App",
        localName: "App",
        localBindingId: "symbol:module:src/App.tsx:App",
        exportKind: "local",
        declarationKind: "value",
        typeOnly: false,
        reexportKind: undefined,
        reexport: {
          status: "none",
        },
      },
      {
        exportedName: "appThemeName",
        sourceExportedName: "themeName",
        localName: undefined,
        localBindingId: undefined,
        exportKind: "re-export",
        declarationKind: "unknown",
        typeOnly: false,
        reexportKind: "named",
        reexport: {
          status: "resolved",
          specifier: "./theme.ts",
          resolvedFilePath: "src/theme.ts",
          resolvedModuleId: "module:src/theme.ts",
          confidence: "exact",
        },
      },
    ],
  );
  assert.deepEqual(appFacts.topLevelBindings, [
    {
      localName: "App",
      bindingId: "symbol:module:src/App.tsx:App",
      bindingKind: "variable",
    },
    {
      localName: "styles",
      bindingId: "symbol:module:src/App.tsx:styles",
      bindingKind: "import-default",
    },
    {
      localName: "themeName",
      bindingId: "symbol:module:src/App.tsx:themeName",
      bindingKind: "import-named",
    },
  ]);

  assert.deepEqual(
    getAllResolvedModuleFacts({ moduleFacts }).map((facts) => facts.filePath),
    ["src/App.tsx", "src/theme.ts"],
  );
});

test("module facts preserve unresolved source import status", () => {
  const moduleFacts = buildModuleFacts({
    parsedFiles: [sourceFile("src/App.tsx", 'import { missing } from "./missing";')],
  });

  const appFacts = getResolvedModuleFacts({
    moduleFacts,
    filePath: "src/App.tsx",
  });
  assert.equal(appFacts?.imports[0]?.resolution.status, "unresolved");
  assert.equal(appFacts?.imports[0]?.resolution.reason, "source-specifier-not-found");
});

test("module facts preserve unresolved stylesheet import status", () => {
  const moduleFacts = buildModuleFacts({
    parsedFiles: [sourceFile("src/App.tsx", 'import "./missing.css";')],
  });

  const appFacts = getResolvedModuleFacts({
    moduleFacts,
    filePath: "src/App.tsx",
  });
  assert.equal(appFacts?.imports[0]?.resolution.status, "unresolved");
  assert.equal(appFacts?.imports[0]?.resolution.reason, "stylesheet-specifier-not-found");
});

function sourceFile(filePath, sourceText) {
  return {
    filePath,
    parsedSourceFile: ts.createSourceFile(
      filePath,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    ),
  };
}
