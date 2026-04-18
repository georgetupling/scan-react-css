import test from "node:test";
import assert from "node:assert/strict";

import { scanReactCss } from "../../dist/index.js";
import { TestProjectBuilder } from "../support/TestProjectBuilder.js";
import { withBuiltProject } from "../support/integrationTestUtils.js";

test("integration scans preserve dynamic-class-reference confidence through the full pipeline", async () => {
  const builder = new TestProjectBuilder().withTemplate("basic-react-app");
  builder.withSourceFile(
    "src/App.tsx",
    "export function App() { return <div className={`panel ${getStateClass()}`} />; }",
  );
  builder.withCssFile("src/App.css", ".panel {}\n.open {}\n");

  await withBuiltProject(builder, async (project) => {
    const result = await scanReactCss({ targetPath: project.rootDir });
    const finding = result.findings.find((entry) => entry.ruleId === "dynamic-class-reference");

    assert.ok(finding);
    assert.equal(finding.confidence, "medium");
  });
});

test("integration scans report dynamic missing css classes from helper-composed references", async () => {
  await withBuiltProject(
    new TestProjectBuilder()
      .withTemplate("basic-react-app")
      .withSourceFile(
        "src/App.tsx",
        [
          'import classNames from "classnames";',
          'export function App() { return <div className={classNames("panel", "missing-" + getSuffix())} />; }',
        ].join("\n"),
      ),
    async (project) => {
      const result = await scanReactCss({ targetPath: project.rootDir });

      assert.ok(
        result.findings.some(
          (finding) =>
            finding.ruleId === "dynamic-missing-css-class" &&
            finding.metadata.sourceExpression === '"missing-" + getSuffix()',
        ),
      );
    },
  );
});

test("integration scans suppress dynamic provider-backed icon composition for active declared providers", async () => {
  await withBuiltProject(
    new TestProjectBuilder()
      .withTemplate("basic-react-app")
      .withFile(
        "index.html",
        [
          "<!doctype html>",
          '<html><head><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" /></head><body><div id="root"></div></body></html>',
        ].join("\n"),
      )
      .withSourceFile(
        "src/App.tsx",
        [
          'import classNames from "classnames";',
          "const enabled = false;",
          'export function App() { return <i className={classNames("fa-solid", enabled ? "fa-chevron-up" : "fa-chevron-down")} />; }',
        ].join("\n"),
      ),
    async (project) => {
      const result = await scanReactCss({ targetPath: project.rootDir });

      assert.ok(!result.findings.some((finding) => finding.ruleId === "dynamic-class-reference"));
      assert.ok(!result.findings.some((finding) => finding.ruleId === "dynamic-missing-css-class"));
    },
  );
});
