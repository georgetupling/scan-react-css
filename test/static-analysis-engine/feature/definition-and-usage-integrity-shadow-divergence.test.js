import test from "node:test";
import assert from "node:assert/strict";

import { runExperimentalSelectorPilotAgainstCurrentScanner } from "../../../dist/static-analysis-engine.js";
import { TestProjectBuilder } from "../../support/TestProjectBuilder.js";

test("definition-and-usage shadow comparison keeps wrapper-owned css as a reviewed baseline-only gap", async () => {
  const project = await new TestProjectBuilder()
    .withTemplate("basic-react-app")
    .withSourceFile(
      "src/App.tsx",
      [
        'import "./Page.css";',
        'import { LayoutShell } from "./LayoutShell";',
        'import { Leaf } from "./Leaf";',
        "export function App() {",
        "  return <LayoutShell><Leaf /></LayoutShell>;",
        "}",
      ].join("\n"),
    )
    .withSourceFile(
      "src/LayoutShell.tsx",
      [
        'import "./Field.css";',
        "export function LayoutShell({ children }: { children: React.ReactNode }) {",
        '  return <section className="field">{children}</section>;',
        "}",
      ].join("\n"),
    )
    .withSourceFile(
      "src/Leaf.tsx",
      'export function Leaf() { return <div className="field__hint page-shell" />; }\n',
    )
    .withCssFile("src/Page.css", ".page-shell {}\n")
    .withCssFile("src/Field.css", ".field {}\n.field__hint {}\n")
    .build();

  try {
    const artifact = await runExperimentalSelectorPilotAgainstCurrentScanner({
      cwd: project.rootDir,
    });

    const fieldHintBaselineOnly = artifact.comparisonResult.comparison.baselineOnly
      .filter((finding) => finding.subject?.className === "field__hint")
      .map((finding) => finding.ruleId)
      .sort();

    assert.deepEqual(fieldHintBaselineOnly, ["unreachable-css", "unused-css-class"]);
    assert.equal(
      artifact.comparisonResult.comparison.baselineOnly.some(
        (finding) => finding.subject?.className === "page-shell",
      ),
      false,
    );
    assert.equal(
      artifact.comparisonResult.comparison.baselineOnly.some(
        (finding) => finding.subject?.className === "field",
      ),
      false,
    );
    assert.ok(
      artifact.comparisonResult.comparison.experimentalOnly.some(
        (finding) =>
          finding.ruleId === "selector-analysis-unsupported" &&
          finding.message.includes(".field__hint"),
      ),
    );
    assert.ok(artifact.comparisonResult.summary.baselineRuleIds.includes("unreachable-css"));
    assert.ok(artifact.comparisonResult.summary.baselineRuleIds.includes("unused-css-class"));
  } finally {
    await project.cleanup();
  }
});
