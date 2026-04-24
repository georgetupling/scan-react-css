import test from "node:test";
import assert from "node:assert/strict";

import { analyzeProjectSourceTexts } from "../../../dist/static-analysis-engine.js";

const FONT_AWESOME_PROVIDER = {
  provider: "font-awesome",
  match: ["**/cdnjs.cloudflare.com/ajax/libs/font-awesome/**/css/*.css"],
  classPrefixes: ["fa-"],
  classNames: ["fa", "fa-solid", "fa-regular", "fa-brands"],
};

test("static analysis engine activates declared external css providers from matching html stylesheet links", () => {
  const result = analyzeProjectSourceTexts({
    sourceFiles: [
      {
        filePath: "src/App.tsx",
        sourceText: 'export function App() { return <i className="fa-solid fa-plus" />; }',
      },
    ],
    externalCss: {
      enabled: true,
      mode: "declared-globals",
      globalProviders: [FONT_AWESOME_PROVIDER],
      htmlStylesheetLinks: [
        {
          filePath: "index.html",
          href: "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css",
          isRemote: true,
        },
      ],
    },
  });

  assert.deepEqual(result.externalCssSummary, {
    enabled: true,
    mode: "declared-globals",
    activeProviders: [
      {
        provider: "font-awesome",
        match: ["**/cdnjs.cloudflare.com/ajax/libs/font-awesome/**/css/*.css"],
        classPrefixes: ["fa-"],
        classNames: ["fa", "fa-brands", "fa-regular", "fa-solid"],
        matchedStylesheets: [
          {
            filePath: "index.html",
            href: "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css",
            isRemote: true,
          },
        ],
      },
    ],
    projectWideStylesheetFilePaths: [],
  });
});

test("static analysis engine treats fetch-remote html-linked external css as project-wide reachable", () => {
  const result = analyzeProjectSourceTexts({
    sourceFiles: [
      {
        filePath: "src/App.tsx",
        sourceText:
          'export function App() { return <button className="btn primary">Save</button>; }',
      },
    ],
    selectorCssSources: [
      {
        filePath: "https://cdn.example.com/ui/buttons.css",
        cssText: ".btn.primary { color: red; }",
      },
    ],
    externalCss: {
      enabled: true,
      mode: "fetch-remote",
      globalProviders: [],
      htmlStylesheetLinks: [
        {
          filePath: "index.html",
          href: "https://cdn.example.com/ui/buttons.css",
          isRemote: true,
        },
      ],
    },
  });

  assert.equal(result.externalCssSummary.projectWideStylesheetFilePaths.length, 1);
  assert.equal(
    result.externalCssSummary.projectWideStylesheetFilePaths[0],
    "https://cdn.example.com/ui/buttons.css",
  );
  assert.equal(result.selectorQueryResults.length, 1);
  assert.equal(result.selectorQueryResults[0].outcome, "match");
  assert.equal(result.reachabilitySummary.stylesheets.length, 1);
  assert.equal(result.reachabilitySummary.stylesheets[0].availability, "definite");

  const sourceFileContext = result.reachabilitySummary.stylesheets[0].contexts.find(
    (contextRecord) => contextRecord.context.kind === "source-file",
  );
  assert.deepEqual(
    sourceFileContext && {
      context: sourceFileContext.context,
      availability: sourceFileContext.availability,
      reasons: sourceFileContext.reasons,
      derivations: sourceFileContext.derivations,
    },
    {
      context: {
        kind: "source-file",
        filePath: "src/App.tsx",
      },
      availability: "definite",
      reasons: ["source file is covered by a project-wide HTML-linked remote external stylesheet"],
      derivations: [
        {
          kind: "source-file-project-wide-external-css",
          stylesheetHref: "https://cdn.example.com/ui/buttons.css",
        },
      ],
    },
  );
});
