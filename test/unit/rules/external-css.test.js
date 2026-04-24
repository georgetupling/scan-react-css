import test from "node:test";
import assert from "node:assert/strict";

import { runRuleScenario, withRuleTempDir, writeProjectFile } from "../../support/ruleTestUtils.js";

test("missing-external-css-class reports missing classes when external css is imported", async () => {
  await withRuleTempDir(async (tempDir) => {
    await writeProjectFile(
      tempDir,
      "src/App.tsx",
      [
        'import "bootstrap/dist/css/bootstrap.css";',
        'export function App() { return <div className="btn ghost-btn" />; }',
      ].join("\n"),
    );
    await writeProjectFile(
      tempDir,
      "node_modules/bootstrap/dist/css/bootstrap.css",
      ".btn { display: inline-block; }",
    );

    const findings = await runRuleScenario(tempDir);
    const ghostFinding = findings.find(
      (finding) =>
        finding.ruleId === "missing-external-css-class" &&
        finding.subject?.className === "ghost-btn",
    );

    assert.ok(ghostFinding);
    assert.ok(
      !findings.some(
        (finding) =>
          finding.ruleId === "missing-external-css-class" && finding.subject?.className === "btn",
      ),
    );
    assert.deepEqual(ghostFinding?.metadata.externalCssSpecifiers, [
      "bootstrap/dist/css/bootstrap.css",
    ]);
    assert.equal(ghostFinding?.metadata.referenceKind, "string-literal");
    assert.equal(typeof ghostFinding?.primaryLocation?.column, "number");
  });
});

test("missing-external-css-class ignores classes satisfied by html-linked declared providers", async () => {
  await withRuleTempDir(async (tempDir) => {
    await writeProjectFile(
      tempDir,
      "index.html",
      [
        "<!doctype html>",
        '<html><head><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" /></head><body></body></html>',
      ].join("\n"),
    );
    await writeProjectFile(
      tempDir,
      "src/App.tsx",
      [
        'import "bootstrap/dist/css/bootstrap.css";',
        'export function App() { return <div className="btn fa-solid fa-trash ghost-btn" />; }',
      ].join("\n"),
    );
    await writeProjectFile(
      tempDir,
      "node_modules/bootstrap/dist/css/bootstrap.css",
      ".btn { display: inline-block; }",
    );

    const findings = await runRuleScenario(tempDir);

    for (const className of ["fa-solid", "fa-trash"]) {
      assert.ok(
        !findings.some(
          (finding) =>
            finding.ruleId === "missing-external-css-class" &&
            finding.subject?.className === className,
        ),
      );
    }

    assert.ok(
      findings.some(
        (finding) =>
          finding.ruleId === "missing-external-css-class" &&
          finding.subject?.className === "ghost-btn",
      ),
    );
  });
});
