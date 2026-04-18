import test from "node:test";
import assert from "node:assert/strict";

import { analyzeSourceText } from "../../../dist/static-analysis-engine.js";

test("static analysis engine builds a same-file module model with imports and symbols", () => {
  const result = analyzeSourceText({
    filePath: "src/App.tsx",
    sourceText: [
      'import React from "react";',
      'import { Button } from "./Button";',
      'import "./App.css";',
      "export function App() {",
      '  return <div className="app-shell" />;',
      "}",
    ].join("\n"),
  });

  const moduleNode = result.moduleGraph.modulesById.get("module:src/App.tsx");

  assert.ok(moduleNode);
  assert.equal(moduleNode.imports.length, 3);
  assert.deepEqual(
    moduleNode.imports.map((entry) => [entry.specifier, entry.importKind]),
    [
      ["react", "source"],
      ["./Button", "source"],
      ["./App.css", "css"],
    ],
  );
  assert.ok(result.symbols.has("symbol:module:src/App.tsx:React"));
  assert.ok(result.symbols.has("symbol:module:src/App.tsx:Button"));
  assert.ok(result.symbols.has("symbol:module:src/App.tsx:App"));
});

test("static analysis engine extracts exact class strings into definite class sets", () => {
  const result = analyzeSourceText({
    filePath: "src/Button.tsx",
    sourceText:
      'export function Button() { return <button className="button button--primary" />; }',
  });

  assert.equal(result.classExpressions.length, 1);
  assert.deepEqual(result.classExpressions[0].value, {
    kind: "string-exact",
    value: "button button--primary",
  });
  assert.deepEqual(result.classExpressions[0].classes.definite, ["button", "button--primary"]);
  assert.deepEqual(result.classExpressions[0].classes.possible, []);
  assert.equal(result.classExpressions[0].classes.unknownDynamic, false);
});

test("static analysis engine preserves bounded conditional class uncertainty", () => {
  const result = analyzeSourceText({
    filePath: "src/Panel.tsx",
    sourceText: [
      "export function Panel({ isOpen }: { isOpen: boolean }) {",
      '  return <section className={isOpen ? "panel is-open" : "panel"} />;',
      "}",
    ].join("\n"),
  });

  assert.equal(result.classExpressions.length, 1);
  assert.deepEqual(result.classExpressions[0].value, {
    kind: "string-set",
    values: ["panel", "panel is-open"],
  });
  assert.deepEqual(result.classExpressions[0].classes.definite, ["panel"]);
  assert.deepEqual(result.classExpressions[0].classes.possible, ["is-open"]);
  assert.equal(result.classExpressions[0].classes.unknownDynamic, false);
});

test("static analysis engine degrades unsupported class expressions to unknown", () => {
  const result = analyzeSourceText({
    filePath: "src/App.tsx",
    sourceText: [
      "const classes = getClasses();",
      "export function App() {",
      "  return <div className={classes} />;",
      "}",
    ].join("\n"),
  });

  assert.equal(result.classExpressions.length, 1);
  assert.deepEqual(result.classExpressions[0].value, {
    kind: "unknown",
    reason: "unsupported-expression:Identifier",
  });
  assert.equal(result.classExpressions[0].classes.unknownDynamic, true);
});

test("static analysis engine builds a same-file render subtree for intrinsic JSX", () => {
  const result = analyzeSourceText({
    filePath: "src/App.tsx",
    sourceText: [
      "export function App() {",
      '  return <section className="app-shell"><h1 className="app-title" /></section>;',
      "}",
    ].join("\n"),
  });

  assert.equal(result.renderSubtrees.length, 1);
  assert.equal(result.renderSubtrees[0].componentName, "App");
  assert.equal(result.renderSubtrees[0].root.kind, "element");
  assert.equal(result.renderSubtrees[0].root.tagName, "section");
  assert.deepEqual(result.renderSubtrees[0].root.className?.classes.definite, ["app-shell"]);
  assert.equal(result.renderSubtrees[0].root.children.length, 1);
  assert.equal(result.renderSubtrees[0].root.children[0].kind, "element");
  assert.equal(result.renderSubtrees[0].root.children[0].tagName, "h1");
});

test("static analysis engine preserves conditional render branches in the subtree IR", () => {
  const result = analyzeSourceText({
    filePath: "src/Panel.tsx",
    sourceText: [
      "export function Panel({ isOpen }: { isOpen: boolean }) {",
      '  return isOpen ? <section className="panel is-open" /> : <section className="panel" />;',
      "}",
    ].join("\n"),
  });

  assert.equal(result.renderSubtrees.length, 1);
  assert.equal(result.renderSubtrees[0].root.kind, "conditional");
  assert.equal(result.renderSubtrees[0].root.conditionSourceText, "isOpen");
  assert.equal(result.renderSubtrees[0].root.whenTrue.kind, "element");
  assert.deepEqual(result.renderSubtrees[0].root.whenTrue.className?.classes.definite, [
    "panel",
    "is-open",
  ]);
  assert.equal(result.renderSubtrees[0].root.whenFalse.kind, "element");
});

test("static analysis engine records unresolved component references explicitly", () => {
  const result = analyzeSourceText({
    filePath: "src/App.tsx",
    sourceText: [
      "function Child() {",
      '  return <div className="child" />;',
      "}",
      "export function App() {",
      "  return <Child />;",
      "}",
    ].join("\n"),
  });

  assert.equal(result.renderSubtrees.length, 2);
  assert.equal(result.renderSubtrees[1].componentName, "App");
  assert.equal(result.renderSubtrees[1].root.kind, "component-reference");
  assert.equal(result.renderSubtrees[1].root.componentName, "Child");
  assert.equal(result.renderSubtrees[1].root.reason, "local-component-expansion-not-implemented");
});
