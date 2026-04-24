import test from "node:test";
import assert from "node:assert/strict";

import { TestProjectBuilder } from "../../support/TestProjectBuilder.js";
import {
  analyzeProjectSourceTexts,
  runExperimentalSelectorPilotAgainstCurrentScanner,
} from "../../../dist/static-analysis-engine.js";

test("static analysis engine feature validation tracks definite stylesheet reachability through component composition", async () => {
  const project = await new TestProjectBuilder()
    .withTemplate("basic-react-app")
    .withSourceFile(
      "src/LayoutShell.tsx",
      [
        'import "./LayoutShell.css";',
        "export function LayoutShell({ children }: { children: React.ReactNode }) {",
        '  return <section className="layout-shell">{children}</section>;',
        "}",
      ].join("\n"),
    )
    .withSourceFile(
      "src/App.tsx",
      [
        'import { LayoutShell } from "./LayoutShell";',
        "export function App() {",
        '  return <LayoutShell><h1 className="page-title" /></LayoutShell>;',
        "}",
      ].join("\n"),
    )
    .withCssFile("src/LayoutShell.css", ".layout-shell .page-title { width: 100%; }\n")
    .build();

  try {
    const result = analyzeProjectSourceTexts(await loadStaticAnalysisProjectInputs(project));
    const [selectorResult] = result.selectorQueryResults;

    assert.equal(result.reachabilitySummary.stylesheets.length, 1);
    assert.equal(result.reachabilitySummary.stylesheets[0].availability, "definite");
    assert.equal(selectorResult.outcome, "match");
    assert.equal(selectorResult.status, "resolved");
    assert.equal(selectorResult.confidence, "high");
    assert.equal(selectorResult.reachability?.availability, "definite");

    const appContext = result.reachabilitySummary.stylesheets[0].contexts.find(
      (contextRecord) =>
        contextRecord.context.kind === "component" &&
        contextRecord.context.filePath === "src/App.tsx" &&
        contextRecord.context.componentName === "App",
    );
    assert.equal(appContext?.availability, "definite");
    assert.ok(
      appContext?.reasons.some(
        (reason) =>
          reason.includes("LayoutShell") && reason.includes("definite stylesheet availability"),
      ),
    );
  } finally {
    await project.cleanup();
  }
});

test("static analysis engine feature validation records possible selector satisfaction and shadow-mode comparison for conditional composition", async () => {
  const project = await new TestProjectBuilder()
    .withTemplate("basic-react-app")
    .withSourceFile(
      "src/LayoutShell.tsx",
      [
        'import "./LayoutShell.css";',
        "export function LayoutShell({ children }: { children: React.ReactNode }) {",
        '  return <section className="layout-shell">{children}</section>;',
        "}",
      ].join("\n"),
    )
    .withSourceFile(
      "src/App.tsx",
      [
        'import { LayoutShell } from "./LayoutShell";',
        "export function App({ showTitle }: { showTitle: boolean }) {",
        '  return showTitle ? <LayoutShell><h1 className="page-title" /></LayoutShell> : <main className="page-title" />;',
        "}",
      ].join("\n"),
    )
    .withCssFile("src/LayoutShell.css", ".layout-shell .page-title { width: 100%; }\n")
    .build();

  try {
    const result = analyzeProjectSourceTexts(await loadStaticAnalysisProjectInputs(project));
    const [selectorResult] = result.selectorQueryResults;

    assert.equal(result.reachabilitySummary.stylesheets.length, 1);
    assert.equal(result.reachabilitySummary.stylesheets[0].availability, "definite");
    assert.equal(selectorResult.outcome, "possible-match");
    assert.equal(selectorResult.status, "resolved");
    assert.equal(selectorResult.confidence, "medium");
    assert.equal(selectorResult.reachability?.availability, "possible");
    assert.ok(
      selectorResult.reachability?.matchedContexts?.some(
        (contextRecord) =>
          contextRecord.context.kind === "render-region" &&
          contextRecord.context.filePath === "src/App.tsx" &&
          contextRecord.context.componentName === "App" &&
          contextRecord.context.regionKind === "conditional-branch",
      ),
    );
    assert.ok(
      result.experimentalRuleResults.some(
        (ruleResult) => ruleResult.ruleId === "selector-possibly-satisfied",
      ),
    );

    const artifact = await runExperimentalSelectorPilotAgainstCurrentScanner({
      cwd: project.rootDir,
    });

    assert.equal(artifact.comparisonResult.summary.matchedCount, 0);
    assert.equal(artifact.comparisonResult.summary.experimentalOnlyCount, 1);
    assert.equal(artifact.comparisonResult.summary.baselineOnlyCount, 2);
    assert.deepEqual(artifact.comparisonResult.summary.experimentalRuleIds, [
      "selector-possibly-satisfied",
    ]);
    assert.deepEqual(artifact.comparisonResult.summary.baselineRuleIds, ["missing-css-class"]);
    assert.ok(
      artifact.comparisonResult.comparison.experimentalOnly.some(
        (finding) => finding.ruleId === "selector-possibly-satisfied",
      ),
    );
    assert.equal(
      artifact.comparisonResult.comparison.baselineOnly.filter(
        (finding) => finding.ruleId === "missing-css-class",
      ).length,
      2,
    );
  } finally {
    await project.cleanup();
  }
});

test("static analysis engine feature validation preserves unknown stylesheet reachability barrier contexts from unsupported cross-file helper expansion", async () => {
  const project = await new TestProjectBuilder()
    .withTemplate("basic-react-app")
    .withSourceFile(
      "src/LayoutShell.tsx",
      [
        'import "./LayoutShell.css";',
        "export function LayoutShell({ children }: { children: React.ReactNode }) {",
        '  return <section className="layout-shell">{children}</section>;',
        "}",
      ].join("\n"),
    )
    .withSourceFile(
      "src/helpers.tsx",
      [
        'import { LayoutShell } from "./LayoutShell";',
        "export function renderLayout(mode: string) {",
        '  return <LayoutShell><h1 className="page-title" /></LayoutShell>;',
        "}",
      ].join("\n"),
    )
    .withSourceFile(
      "src/App.tsx",
      [
        'import { renderLayout } from "./helpers";',
        "export function App({ showLayout }: { showLayout: boolean }) {",
        '  return showLayout ? renderLayout() : <main className="page-title" />;',
        "}",
      ].join("\n"),
    )
    .withCssFile("src/LayoutShell.css", ".layout-shell .page-title { width: 100%; }\n")
    .build();

  try {
    const result = analyzeProjectSourceTexts(await loadStaticAnalysisProjectInputs(project));
    const [selectorResult] = result.selectorQueryResults;

    assert.equal(result.reachabilitySummary.stylesheets.length, 1);
    assert.equal(result.reachabilitySummary.stylesheets[0].availability, "definite");
    assert.equal(selectorResult.outcome, "match");
    assert.equal(selectorResult.status, "resolved");
    assert.equal(selectorResult.confidence, "high");
    assert.equal(selectorResult.reachability?.availability, "definite");

    const appUnknownContext = result.reachabilitySummary.stylesheets[0].contexts.find(
      (contextRecord) =>
        contextRecord.context.kind === "component" &&
        contextRecord.context.filePath === "src/App.tsx" &&
        contextRecord.context.componentName === "App" &&
        contextRecord.availability === "unknown",
    );
    assert.equal(appUnknownContext?.availability, "unknown");
    assert.deepEqual(appUnknownContext?.derivations, [
      {
        kind: "whole-component-unknown-barrier",
        reason: "cross-file-helper-expansion-unsupported-arguments",
      },
    ]);

    const unknownBranchContext = result.reachabilitySummary.stylesheets[0].contexts.find(
      (contextRecord) =>
        contextRecord.context.kind === "render-region" &&
        contextRecord.context.filePath === "src/App.tsx" &&
        contextRecord.context.componentName === "App" &&
        contextRecord.context.regionKind === "conditional-branch" &&
        contextRecord.availability === "unknown",
    );
    assert.equal(unknownBranchContext?.availability, "unknown");
    assert.deepEqual(unknownBranchContext?.derivations, [
      {
        kind: "render-region-unknown-barrier",
        reason: "cross-file-helper-expansion-unsupported-arguments",
      },
    ]);
  } finally {
    await project.cleanup();
  }
});

async function loadStaticAnalysisProjectInputs(project) {
  const filePaths = await project.listFiles();
  const sourcePaths = filePaths.filter(
    (filePath) =>
      filePath.startsWith("src/") &&
      (filePath.endsWith(".ts") ||
        filePath.endsWith(".tsx") ||
        filePath.endsWith(".js") ||
        filePath.endsWith(".jsx")),
  );
  const cssPaths = filePaths.filter(
    (filePath) => filePath.startsWith("src/") && filePath.endsWith(".css"),
  );

  const [sourceFiles, selectorCssSources] = await Promise.all([
    Promise.all(
      sourcePaths.map(async (filePath) => ({
        filePath,
        sourceText: await project.readFile(filePath),
      })),
    ),
    Promise.all(
      cssPaths.map(async (filePath) => ({
        filePath,
        cssText: await project.readFile(filePath),
      })),
    ),
  ]);

  return {
    sourceFiles,
    selectorCssSources,
  };
}
