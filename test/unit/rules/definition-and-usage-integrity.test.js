import test from "node:test";
import assert from "node:assert/strict";

import { runRuleScenario, withRuleTempDir, writeProjectFile } from "../../support/ruleTestUtils.js";

test("missing-css-class reports missing raw class references but not valid imports", async () => {
  await withRuleTempDir(async (tempDir) => {
    await writeProjectFile(
      tempDir,
      "src/Missing.tsx",
      'export function Missing() { return <div className="missing" />; }',
    );
    await writeProjectFile(
      tempDir,
      "src/Present.tsx",
      [
        'import "./Present.css";',
        'export function Present() { return <div className="present" />; }',
      ].join("\n"),
    );
    await writeProjectFile(tempDir, "src/Present.css", ".present {}");

    const findings = await runRuleScenario(tempDir);

    assert.ok(
      findings.some(
        (finding) =>
          finding.ruleId === "missing-css-class" && finding.subject?.className === "missing",
      ),
    );
    const missingFinding = findings.find(
      (finding) =>
        finding.ruleId === "missing-css-class" && finding.subject?.className === "missing",
    );
    assert.equal(missingFinding?.primaryLocation?.filePath, "src/Missing.tsx");
    assert.equal(missingFinding?.primaryLocation?.line, 1);
    assert.ok(typeof missingFinding?.primaryLocation?.column === "number");
    assert.ok(
      !findings.some(
        (finding) =>
          finding.ruleId === "missing-css-class" && finding.subject?.className === "present",
      ),
    );
  });
});

test("unreachable-css reports classes defined outside reachable css but not reachable ones", async () => {
  await withRuleTempDir(async (tempDir) => {
    await writeProjectFile(
      tempDir,
      "src/Unreachable.tsx",
      'export function Unreachable() { return <div className="orphan" />; }',
    );
    await writeProjectFile(tempDir, "src/Other.css", ".orphan {}");
    await writeProjectFile(
      tempDir,
      "src/Reachable.tsx",
      [
        'import "./Reachable.css";',
        'export function Reachable() { return <div className="ready" />; }',
      ].join("\n"),
    );
    await writeProjectFile(tempDir, "src/Reachable.css", ".ready {}");

    const findings = await runRuleScenario(tempDir);

    assert.ok(
      findings.some(
        (finding) =>
          finding.ruleId === "unreachable-css" && finding.subject?.className === "orphan",
      ),
    );
    assert.ok(
      !findings.some(
        (finding) => finding.ruleId === "unreachable-css" && finding.subject?.className === "ready",
      ),
    );
  });
});

test("unreachable-css does not report classes inherited from all known render contexts", async () => {
  await withRuleTempDir(async (tempDir) => {
    await writeProjectFile(
      tempDir,
      "src/pages/Page.tsx",
      [
        'import "./Page.css";',
        'import { Child } from "../components/Child";',
        "export function Page() { return <Child />; }",
      ].join("\n"),
    );
    await writeProjectFile(
      tempDir,
      "src/components/Child.tsx",
      'export function Child() { return <div className="page-shell" />; }',
    );
    await writeProjectFile(tempDir, "src/pages/Page.css", ".page-shell {}");

    const findings = await runRuleScenario(tempDir);

    assert.ok(
      !findings.some(
        (finding) =>
          finding.ruleId === "unreachable-css" && finding.subject?.className === "page-shell",
      ),
    );
  });
});

test("unreachable-css is advisory when css is only available from some known render contexts", async () => {
  await withRuleTempDir(async (tempDir) => {
    await writeProjectFile(
      tempDir,
      "src/pages/PageWithCss.tsx",
      [
        'import "./PageWithCss.css";',
        'import { Child } from "../components/Child";',
        "export function PageWithCss() { return <Child />; }",
      ].join("\n"),
    );
    await writeProjectFile(
      tempDir,
      "src/pages/PageWithoutCss.tsx",
      [
        'import { Child } from "../components/Child";',
        "export function PageWithoutCss() { return <Child />; }",
      ].join("\n"),
    );
    await writeProjectFile(
      tempDir,
      "src/components/Child.tsx",
      'export function Child() { return <div className="page-shell" />; }',
    );
    await writeProjectFile(tempDir, "src/pages/PageWithCss.css", ".page-shell {}");

    const findings = await runRuleScenario(tempDir);
    const finding = findings.find(
      (entry) => entry.ruleId === "unreachable-css" && entry.subject?.className === "page-shell",
    );

    assert.ok(finding);
    assert.equal(finding.confidence, "low");
    assert.match(finding.message, /may be available via some render contexts/);
    assert.equal(finding.metadata?.renderContextReachability, "possible");
    assert.deepEqual(finding.metadata?.possibleRenderContextCssFiles, [
      "src/pages/PageWithCss.css",
    ]);
  });
});

test("missing-css-class does not report classes satisfied only through wrapper render context", async () => {
  await withRuleTempDir(async (tempDir) => {
    await writeProjectFile(
      tempDir,
      "src/App.tsx",
      [
        'import { Wrapper } from "./Wrapper";',
        "export function App() { return <Wrapper />; }",
      ].join("\n"),
    );
    await writeProjectFile(
      tempDir,
      "src/Wrapper.tsx",
      [
        'import "./Field.css";',
        'import { Leaf } from "./Leaf";',
        "export function Wrapper() { return <Leaf />; }",
      ].join("\n"),
    );
    await writeProjectFile(
      tempDir,
      "src/Leaf.tsx",
      'export function Leaf() { return <div className="field__hint" />; }',
    );
    await writeProjectFile(tempDir, "src/Field.css", ".field__hint {}");

    const findings = await runRuleScenario(tempDir);

    assert.ok(
      !findings.some(
        (finding) =>
          finding.ruleId === "missing-css-class" && finding.subject?.className === "field__hint",
      ),
    );
  });
});

test("unused-css-class does not report classes used only through wrapper render context", async () => {
  await withRuleTempDir(async (tempDir) => {
    await writeProjectFile(
      tempDir,
      "src/App.tsx",
      [
        'import { Wrapper } from "./Wrapper";',
        "export function App() { return <Wrapper />; }",
      ].join("\n"),
    );
    await writeProjectFile(
      tempDir,
      "src/Wrapper.tsx",
      [
        'import "./Field.css";',
        'import { Leaf } from "./Leaf";',
        "export function Wrapper() { return <Leaf />; }",
      ].join("\n"),
    );
    await writeProjectFile(
      tempDir,
      "src/Leaf.tsx",
      'export function Leaf() { return <div className="field__hint" />; }',
    );
    await writeProjectFile(tempDir, "src/Field.css", ".field__hint {}\n.unused {}");

    const findings = await runRuleScenario(tempDir);

    assert.ok(
      !findings.some(
        (finding) =>
          finding.ruleId === "unused-css-class" && finding.subject?.className === "field__hint",
      ),
    );
    assert.ok(
      findings.some(
        (finding) => finding.ruleId === "unused-css-class" && finding.subject?.className === "unused",
      ),
    );
  });
});

test("unreachable-css stays advisory for layout utility css available on only one render path", async () => {
  await withRuleTempDir(async (tempDir) => {
    await writeProjectFile(
      tempDir,
      "src/App.tsx",
      [
        'import { StyledLayout } from "./StyledLayout";',
        'import { PlainLayout } from "./PlainLayout";',
        "export function App() { return <><StyledLayout /><PlainLayout /></>; }",
      ].join("\n"),
    );
    await writeProjectFile(
      tempDir,
      "src/StyledLayout.tsx",
      [
        'import "./layout.css";',
        'import { Child } from "./Child";',
        "export function StyledLayout() { return <Child />; }",
      ].join("\n"),
    );
    await writeProjectFile(
      tempDir,
      "src/PlainLayout.tsx",
      [
        'import { Child } from "./Child";',
        "export function PlainLayout() { return <Child />; }",
      ].join("\n"),
    );
    await writeProjectFile(
      tempDir,
      "src/Child.tsx",
      'export function Child() { return <div className="page-flow" />; }',
    );
    await writeProjectFile(tempDir, "src/layout.css", ".page-flow {}");

    const findings = await runRuleScenario(tempDir);
    const finding = findings.find(
      (entry) => entry.ruleId === "unreachable-css" && entry.subject?.className === "page-flow",
    );

    assert.ok(finding);
    assert.equal(finding.confidence, "low");
    assert.equal(finding.metadata?.renderContextReachability, "possible");
    assert.deepEqual(finding.metadata?.possibleRenderContextCssFiles, ["src/layout.css"]);
  });
});

test("unused-css-class reports unused project css classes but not used ones", async () => {
  await withRuleTempDir(async (tempDir) => {
    await writeProjectFile(
      tempDir,
      "src/App.tsx",
      ['import "./App.css";', 'export function App() { return <div className="used" />; }'].join(
        "\n",
      ),
    );
    await writeProjectFile(tempDir, "src/App.css", ".used {} .unused {}");

    const findings = await runRuleScenario(tempDir);

    assert.ok(
      findings.some(
        (finding) =>
          finding.ruleId === "unused-css-class" && finding.subject?.className === "unused",
      ),
    );
    assert.ok(
      !findings.some(
        (finding) => finding.ruleId === "unused-css-class" && finding.subject?.className === "used",
      ),
    );
  });
});

test("unused-css-class includes the CSS definition line number", async () => {
  await withRuleTempDir(async (tempDir) => {
    await writeProjectFile(
      tempDir,
      "src/App.tsx",
      ['import "./App.css";', 'export function App() { return <div className="used" />; }'].join(
        "\n",
      ),
    );
    await writeProjectFile(tempDir, "src/App.css", ".used {}\n.unused {}\n");

    const findings = await runRuleScenario(tempDir);
    const finding = findings.find(
      (entry) => entry.ruleId === "unused-css-class" && entry.subject?.className === "unused",
    );

    assert.ok(finding);
    assert.equal(finding.primaryLocation?.filePath, "src/App.css");
    assert.equal(finding.primaryLocation?.line, 2);
  });
});

test("unused-css-class does not report classes that are used through const-backed composition", async () => {
  await withRuleTempDir(async (tempDir) => {
    await writeProjectFile(
      tempDir,
      "src/Button.tsx",
      [
        'import "./Button.css";',
        "const variant = 'primary';",
        "const isLoading = true;",
        "const buttonClassName = `button button--${variant}`;",
        "export function Button() {",
        "  return (",
        "    <button className={buttonClassName}>",
        '      {isLoading && <span className={isLoading && "button__spinner"} />}',
        "    </button>",
        "  );",
        "}",
      ].join("\n"),
    );
    await writeProjectFile(
      tempDir,
      "src/Button.css",
      ".button {}\n.button--primary {}\n.button__spinner {}\n.button--ghost {}\n",
    );

    const findings = await runRuleScenario(tempDir);

    for (const className of ["button", "button--primary", "button__spinner"]) {
      assert.ok(
        !findings.some(
          (finding) =>
            finding.ruleId === "unused-css-class" && finding.subject?.className === className,
        ),
      );
    }

    assert.ok(
      findings.some(
        (finding) =>
          finding.ruleId === "unused-css-class" && finding.subject?.className === "button--ghost",
      ),
    );
  });
});

test("compound and contextual selectors do not satisfy plain missing-css-class references", async () => {
  await withRuleTempDir(async (tempDir) => {
    await writeProjectFile(
      tempDir,
      "src/App.tsx",
      [
        'import "./App.css";',
        'export function App() { return <div className="button icon" />; }',
      ].join("\n"),
    );
    await writeProjectFile(
      tempDir,
      "src/App.css",
      [".button.button--primary {}", ".toolbar .icon {}"].join("\n"),
    );

    const findings = await runRuleScenario(tempDir);

    assert.ok(
      findings.some(
        (finding) =>
          finding.ruleId === "missing-css-class" && finding.subject?.className === "button",
      ),
    );
    assert.ok(
      findings.some(
        (finding) =>
          finding.ruleId === "missing-css-class" && finding.subject?.className === "icon",
      ),
    );
    assert.ok(
      !findings.some(
        (finding) =>
          finding.ruleId === "unreachable-css" && finding.subject?.className === "button",
      ),
    );
  });
});

test("compound and contextual selectors are excluded from plain unused-css-class evidence", async () => {
  await withRuleTempDir(async (tempDir) => {
    await writeProjectFile(
      tempDir,
      "src/App.tsx",
      [
        'import "./App.css";',
        'export function App() { return <div className="button icon" />; }',
      ].join("\n"),
    );
    await writeProjectFile(
      tempDir,
      "src/App.css",
      [".button.button--primary {}", ".toolbar .icon {}", ".button {}", ".used:hover {}"].join(
        "\n",
      ),
    );

    const findings = await runRuleScenario(tempDir);

    assert.ok(
      !findings.some(
        (finding) => finding.ruleId === "unused-css-class" && finding.subject?.className === "icon",
      ),
    );
    assert.ok(
      !findings.some(
        (finding) =>
          finding.ruleId === "unused-css-class" && finding.subject?.className === "button--primary",
      ),
    );
    assert.ok(
      !findings.some(
        (finding) =>
          finding.ruleId === "unused-css-class" && finding.subject?.className === "button",
      ),
    );
  });
});

test("imported external css class definitions prevent false missing-css-class findings", async () => {
  await withRuleTempDir(async (tempDir) => {
    await writeProjectFile(
      tempDir,
      "src/App.tsx",
      [
        'import "bootstrap/dist/css/bootstrap.css";',
        'export function App() { return <div className="btn missing" />; }',
      ].join("\n"),
    );
    await writeProjectFile(
      tempDir,
      "node_modules/bootstrap/dist/css/bootstrap.css",
      ".btn { display: inline-block; }",
    );

    const findings = await runRuleScenario(tempDir);

    assert.ok(
      !findings.some(
        (finding) => finding.ruleId === "missing-css-class" && finding.subject?.className === "btn",
      ),
    );
    assert.ok(
      findings.some(
        (finding) =>
          finding.ruleId === "missing-css-class" && finding.subject?.className === "missing",
      ),
    );
  });
});

test("html-linked built-in external css providers prevent false missing-css-class findings", async () => {
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
      'export function App() { return <div className="fa-solid fa-plus missing" />; }',
    );

    const findings = await runRuleScenario(tempDir);

    for (const className of ["fa-solid", "fa-plus"]) {
      assert.ok(
        !findings.some(
          (finding) =>
            finding.ruleId === "missing-css-class" && finding.subject?.className === className,
        ),
      );
    }

    assert.ok(
      findings.some(
        (finding) =>
          finding.ruleId === "missing-css-class" && finding.subject?.className === "missing",
      ),
    );
  });
});

test("html-linked bootstrap-icons provider prevents false missing-css-class findings", async () => {
  await withRuleTempDir(async (tempDir) => {
    await writeProjectFile(
      tempDir,
      "index.html",
      [
        "<!doctype html>",
        '<html><head><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.13.1/font/bootstrap-icons.min.css" /></head><body></body></html>',
      ].join("\n"),
    );
    await writeProjectFile(
      tempDir,
      "src/App.tsx",
      'export function App() { return <div className="bi bi-trash missing" />; }',
    );

    const findings = await runRuleScenario(tempDir);

    for (const className of ["bi", "bi-trash"]) {
      assert.ok(
        !findings.some(
          (finding) =>
            finding.ruleId === "missing-css-class" && finding.subject?.className === className,
        ),
      );
    }

    assert.ok(
      findings.some(
        (finding) =>
          finding.ruleId === "missing-css-class" && finding.subject?.className === "missing",
      ),
    );
  });
});
