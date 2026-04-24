import test from "node:test";
import assert from "node:assert/strict";

import { scanReactCss } from "../../../dist/index.js";
import { TestProjectBuilder } from "../../support/TestProjectBuilder.js";
import { withBuiltProject } from "../../support/integrationTestUtils.js";

test("definition-and-usage cutover readiness keeps missing and unreachable findings distinct", async () => {
  await withBuiltProject(
    new TestProjectBuilder()
      .withTemplate("basic-react-app")
      .withSourceFile(
        "src/App.tsx",
        'export function App() { return <><div className="missing-shell" /><div className="orphan-shell" /></>; }\n',
      )
      .withCssFile("src/Other.css", ".orphan-shell {}\n"),
    async (project) => {
      const result = await scanReactCss({ targetPath: project.rootDir });

      assert.ok(hasFinding(result.findings, "missing-css-class", "missing-shell"));
      assert.ok(hasFinding(result.findings, "unreachable-css", "orphan-shell"));
      assert.ok(!hasFinding(result.findings, "unreachable-css", "missing-shell"));
      assert.ok(!hasFinding(result.findings, "missing-css-class", "orphan-shell"));
    },
  );
});

test("definition-and-usage cutover readiness preserves source-import reachability without over-crediting wrapper-owned CSS", async () => {
  await withBuiltProject(
    new TestProjectBuilder()
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
      .withCssFile("src/Field.css", ".field {}\n.field__hint {}\n"),
    async (project) => {
      const result = await scanReactCss({ targetPath: project.rootDir });

      for (const className of ["field", "page-shell"]) {
        assert.ok(!hasFinding(result.findings, "missing-css-class", className));
        assert.ok(!hasFinding(result.findings, "unreachable-css", className));
        assert.ok(!hasFinding(result.findings, "unused-css-class", className));
      }

      assert.ok(!hasFinding(result.findings, "missing-css-class", "field__hint"));
      assert.ok(hasFinding(result.findings, "unreachable-css", "field__hint"));
      assert.ok(hasFinding(result.findings, "unused-css-class", "field__hint"));
    },
  );
});

test("definition-and-usage cutover readiness preserves partial-context findings", async () => {
  await withBuiltProject(
    new TestProjectBuilder()
      .withTemplate("basic-react-app")
      .withSourceFile(
        "src/StyledLayout.tsx",
        [
          'import "./layout.css";',
          'import { Child } from "./Child";',
          "export function StyledLayout() { return <Child />; }",
        ].join("\n"),
      )
      .withSourceFile(
        "src/PlainLayout.tsx",
        [
          'import { Child } from "./Child";',
          "export function PlainLayout() { return <Child />; }",
        ].join("\n"),
      )
      .withSourceFile(
        "src/App.tsx",
        [
          'import { StyledLayout } from "./StyledLayout";',
          'import { PlainLayout } from "./PlainLayout";',
          "export function App() { return <><StyledLayout /><PlainLayout /></>; }",
        ].join("\n"),
      )
      .withSourceFile(
        "src/Child.tsx",
        'export function Child() { return <div className="page-flow" />; }\n',
      )
      .withCssFile("src/layout.css", ".page-flow {}\n"),
    async (project) => {
      const result = await scanReactCss({ targetPath: project.rootDir });

      assert.ok(hasFinding(result.findings, "css-class-missing-in-some-contexts", "page-flow"));
      assert.ok(!hasFinding(result.findings, "missing-css-class", "page-flow"));
      assert.ok(!hasFinding(result.findings, "unreachable-css", "page-flow"));
    },
  );
});

test("definition-and-usage cutover readiness keeps plain-class and external-css semantics stable", async () => {
  await withBuiltProject(
    new TestProjectBuilder()
      .withTemplate("basic-react-app")
      .withSourceFile(
        "src/App.tsx",
        [
          'import "./App.css";',
          'import "library/styles.css";',
          'export function App() { return <div className="button icon btn missing-remote" />; }',
        ].join("\n"),
      )
      .withCssFile("src/App.css", ".button.button--primary {}\n.toolbar .icon {}\n")
      .withNodeModuleFile("library/styles.css", ".btn {}\n"),
    async (project) => {
      const result = await scanReactCss({ targetPath: project.rootDir });

      assert.ok(!hasFinding(result.findings, "missing-css-class", "button"));
      assert.ok(!hasFinding(result.findings, "missing-css-class", "btn"));
      assert.ok(hasFinding(result.findings, "missing-css-class", "icon"));
      assert.ok(hasFinding(result.findings, "missing-css-class", "missing-remote"));

      for (const className of ["button", "icon", "btn"]) {
        assert.ok(!hasFinding(result.findings, "unreachable-css", className));
      }

      for (const className of ["button--primary", "icon"]) {
        assert.ok(!hasFinding(result.findings, "unused-css-class", className));
      }
    },
  );
});

test("definition-and-usage cutover readiness keeps partial-template unused-css policy and fallback stable", async () => {
  await withBuiltProject(createPartialTemplateProject(), async (project) => {
    const result = await scanReactCss({ targetPath: project.rootDir });

    for (const className of ["button--primary", "button--ghost", "button--destructive"]) {
      assert.ok(!hasFinding(result.findings, "unused-css-class", className));
    }
  });

  await withBuiltProject(
    createPartialTemplateProject({ disableMatching: true }),
    async (project) => {
      const result = await scanReactCss({ targetPath: project.rootDir });

      for (const className of ["button--primary", "button--ghost", "button--destructive"]) {
        assert.ok(hasFinding(result.findings, "unused-css-class", className));
      }
    },
  );
});

function createPartialTemplateProject(options = {}) {
  const builder = new TestProjectBuilder()
    .withTemplate("basic-react-app")
    .withSourceFile(
      "src/Button.tsx",
      [
        'import "./Button.css";',
        "export function Button() { return <button className={`button--${variant}`} />; }",
      ].join("\n"),
    )
    .withCssFile(
      "src/Button.css",
      ".button--primary {}\n.button--ghost {}\n.button--destructive {}\n",
    );

  if (options.disableMatching) {
    builder.withConfig({
      classComposition: {
        partialTemplateMatching: {
          enabled: false,
        },
      },
    });
  }

  return builder;
}

function hasFinding(findings, ruleId, className) {
  return findings.some(
    (finding) => finding.ruleId === ruleId && finding.subject?.className === className,
  );
}
