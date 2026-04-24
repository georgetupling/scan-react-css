import test from "node:test";
import assert from "node:assert/strict";

import { scanReactCss } from "../../../dist/index.js";
import { runExperimentalSelectorPilotAgainstCurrentScanner } from "../../../dist/static-analysis-engine.js";
import { TestProjectBuilder } from "../../support/TestProjectBuilder.js";
import { withBuiltProject } from "../../support/integrationTestUtils.js";

test("optimization cutover readiness keeps the first-wave migrated rules and utility replacement together in shipped runtime output", async () => {
  await withBuiltProject(createOptimizationCutoverProject(), async (project) => {
    const result = await scanReactCss({ targetPath: project.rootDir });

    assert.ok(hasRuleFinding(result.findings, "utility-class-replacement"));
    assert.ok(hasRuleFinding(result.findings, "duplicate-css-class-definition"));
    assert.ok(hasRuleFinding(result.findings, "empty-css-rule"));
    assert.ok(hasRuleFinding(result.findings, "redundant-css-declaration-block"));
    assert.ok(hasRuleFinding(result.findings, "unused-compound-selector-branch"));
  });
});

test("optimization cutover readiness keeps first-wave native matches explicit while utility replacement stays baseline-only by design", async () => {
  await withBuiltProject(createOptimizationCutoverProject(), async (project) => {
    const artifact = await runExperimentalSelectorPilotAgainstCurrentScanner({
      cwd: project.rootDir,
    });

    const targetedMatchedRuleIds = [
      ...new Set(
        artifact.comparisonResult.comparison.matched
          .map((entry) => entry.experimental.ruleId)
          .filter((ruleId) =>
            [
              "duplicate-css-class-definition",
              "empty-css-rule",
              "redundant-css-declaration-block",
              "unused-compound-selector-branch",
            ].includes(ruleId),
          ),
      ),
    ].sort();

    assert.deepEqual(targetedMatchedRuleIds, [
      "duplicate-css-class-definition",
      "empty-css-rule",
      "redundant-css-declaration-block",
      "unused-compound-selector-branch",
    ]);
    assert.ok(
      artifact.comparisonResult.comparison.baselineOnly.some(
        (finding) => finding.ruleId === "utility-class-replacement",
      ),
    );
  });
});

function createOptimizationCutoverProject() {
  return new TestProjectBuilder()
    .withTemplate("basic-react-app")
    .withSourceFile(
      "src/App.tsx",
      [
        'import "./App.css";',
        'export function App() { return <><div className="cardStack panel" /><div className="empty" /></>; }',
      ].join("\n"),
    )
    .withCssFile(
      "src/App.css",
      [
        ".empty {}",
        ".button { display: flex; gap: 1rem; }",
        ".button { gap: 1rem; display: flex; }",
        ".panel {}",
        ".panel.is-open {}",
        ".cardStack { display: flex; gap: 8px; }",
      ].join("\n"),
    )
    .withCssFile("src/A.css", ".shared {}\n")
    .withCssFile("src/B.css", ".shared {}\n")
    .withCssFile("src/styles/utilities.css", ".flex { display: flex; }\n.gap-2 { gap: 8px; }\n")
    .withConfig({
      css: {
        utilities: ["src/styles/utilities.css"],
      },
    });
}

function hasRuleFinding(findings, ruleId) {
  return findings.some((finding) => finding.ruleId === ruleId);
}
