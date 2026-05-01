import assert from "node:assert/strict";
import test from "node:test";
import { analyzeProjectSourceTexts } from "../../dist/static-analysis-engine.js";

test("static analysis result exposes staged analysis evidence", () => {
  const result = analyzeProjectSourceTexts({
    sourceFiles: [
      {
        filePath: "src/App.tsx",
        sourceText: 'export function App() { return <main className="root" />; }\n',
      },
    ],
    selectorCssSources: [
      {
        filePath: "src/App.css",
        cssText: ".root { color: red; }\n",
      },
    ],
  });

  assert.ok(result.analysisEvidence);
  assert.equal(result.analysisEvidence.projectEvidence.entities.classReferences.length, 1);
  assert.equal(result.analysisEvidence.projectEvidence.entities.classDefinitions.length, 1);
  assert.equal(
    result.analysisEvidence.selectorReachability.meta.generatedAtStage,
    "selector-reachability",
  );
  assert.equal(
    result.analysisEvidence.ownershipInference.meta.generatedAtStage,
    "ownership-inference",
  );
});

test("analysis evidence exposes reference match semantics for reachable and unreachable definitions", () => {
  const result = analyzeProjectSourceTexts({
    sourceFiles: [
      {
        filePath: "src/App.tsx",
        sourceText:
          'export function App(props) { return <><main className="ghost" /><section className={props.active ? "maybe" : "other"} /></>; }\n',
      },
    ],
    selectorCssSources: [
      {
        filePath: "src/unused.css",
        cssText: ".ghost { color: red; }\n.maybe { color: blue; }\n",
      },
    ],
  });

  const analysis = result.analysisEvidence.projectEvidence;
  const definiteReference = analysis.entities.classReferences.find((reference) =>
    reference.definiteClassNames.includes("ghost"),
  );
  const possibleReference = analysis.entities.classReferences.find((reference) =>
    reference.possibleClassNames.includes("maybe"),
  );
  assert.ok(definiteReference);
  assert.ok(possibleReference);
  const ghostMatch = analysis.relations.referenceMatches.find(
    (match) => match.referenceId === definiteReference.id && match.className === "ghost",
  );
  const maybeMatch = analysis.relations.referenceMatches.find(
    (match) => match.referenceId === possibleReference.id && match.className === "maybe",
  );

  assert.ok(ghostMatch);
  assert.equal(ghostMatch.className, "ghost");
  assert.equal(ghostMatch.referenceClassKind, "definite");
  assert.equal(ghostMatch.reachability, "unavailable");
  assert.equal(ghostMatch.matchKind, "unreachable-stylesheet");
  assert.ok(maybeMatch);
  assert.equal(maybeMatch.className, "maybe");
  assert.equal(maybeMatch.referenceClassKind, "possible");
});

test("analysis evidence prefers supplied stylesheet inventory for origin and CSS Module kind", () => {
  const result = analyzeProjectSourceTexts({
    sourceFiles: [
      {
        filePath: "src/App.tsx",
        sourceText: [
          'import styles from "./App.module.css";',
          'import "pkg/styles.css";',
          "export function App() { return <main className={styles.root}>Hello</main>; }",
          "",
        ].join("\n"),
      },
    ],
    selectorCssSources: [
      {
        filePath: "src/App.module.css",
        cssText: ".root { display: block; }\n",
      },
      {
        filePath: "node_modules/pkg/styles.css",
        cssText: ".pkg { display: block; }\n",
      },
    ],
    stylesheets: [
      {
        filePath: "src/App.module.css",
        cssKind: "css-module",
        origin: "project",
      },
      {
        filePath: "node_modules/pkg/styles.css",
        cssKind: "global-css",
        origin: "package",
      },
    ],
  });

  const stylesheetsByPath = new Map(
    result.analysisEvidence.projectEvidence.entities.stylesheets.map((stylesheet) => [
      stylesheet.filePath,
      stylesheet,
    ]),
  );
  const definitionsByStylesheetId = new Map(
    result.analysisEvidence.projectEvidence.entities.classDefinitions.map((definition) => [
      definition.stylesheetId,
      definition,
    ]),
  );
  const moduleStylesheet = stylesheetsByPath.get("src/App.module.css");
  const packageStylesheet = stylesheetsByPath.get("node_modules/pkg/styles.css");

  assert.equal(moduleStylesheet?.origin, "css-module");
  assert.equal(packageStylesheet?.origin, "external-import");
  assert.equal(
    moduleStylesheet ? definitionsByStylesheetId.get(moduleStylesheet.id)?.isCssModule : undefined,
    true,
  );
});

test("analysis evidence records class references from statically skipped render branches", () => {
  const result = analyzeProjectSourceTexts({
    sourceFiles: [
      {
        filePath: "src/App.tsx",
        sourceText: [
          "export function App() {",
          "  const count = 0;",
          "  const hasItems = count > 0;",
          '  return hasItems ? <span className="badge-count" /> : null;',
          "}",
          "",
        ].join("\n"),
      },
    ],
    selectorCssSources: [
      {
        filePath: "src/App.css",
        cssText: ".badge-count { color: red; }\n",
      },
    ],
  });

  const analysis = result.analysisEvidence.projectEvidence;
  assert.equal(analysis.indexes.classReferenceIdsByClassName.get("badge-count"), undefined);
  const skippedReferences = analysis.entities.staticallySkippedClassReferences.filter(
    (reference) =>
      reference.definiteClassNames.includes("badge-count") ||
      reference.possibleClassNames.includes("badge-count"),
  );
  assert.equal(skippedReferences.length, 1);
  const skippedReference = skippedReferences[0];
  assert.ok(skippedReference);
  assert.equal(skippedReference.conditionSourceText, "hasItems");
  assert.equal(skippedReference.skippedBranch, "when-true");
  assert.equal(skippedReference.reason, "condition-resolved-false");
});

test("analysis evidence indexes declared-provider satisfaction from resource edges", () => {
  const result = analyzeProjectSourceTexts({
    sourceFiles: [
      {
        filePath: "src/App.tsx",
        sourceText: 'export function App() { return <i className="fa-user" />; }\n',
      },
    ],
    resourceEdges: [
      {
        kind: "html-stylesheet",
        fromHtmlFilePath: "index.html",
        href: "https://cdn.example/fontawesome.css",
        isRemote: true,
      },
      {
        kind: "html-script",
        fromHtmlFilePath: "index.html",
        src: "/src/App.tsx",
        resolvedFilePath: "src/App.tsx",
        appRootPath: ".",
      },
    ],
    externalCss: {
      globalProviders: [
        {
          provider: "fontawesome",
          match: ["https://cdn.example/*.css"],
          classPrefixes: ["fa-"],
          classNames: [],
        },
      ],
    },
  });

  const analysis = result.analysisEvidence.projectEvidence;
  const reference = analysis.entities.classReferences[0];
  const satisfaction = analysis.relations.providerClassSatisfactions.find(
    (candidate) => candidate.referenceId === reference.id && candidate.className === "fa-user",
  );

  assert.ok(satisfaction);
  assert.equal(satisfaction.className, "fa-user");
  assert.equal(satisfaction.referenceClassKind, "definite");
  assert.equal(satisfaction.provider, "fontawesome");
});

test("analysis evidence exposes ownership evidence for class definitions", () => {
  const result = analyzeProjectSourceTexts({
    sourceFiles: [
      {
        filePath: "src/components/Button.tsx",
        sourceText:
          'import "../styles/button.css";\nexport function Button() { return <button className="button">Save</button>; }\n',
      },
    ],
    selectorCssSources: [
      {
        filePath: "src/styles/button.css",
        cssText: ".button { display: block; }\n",
      },
    ],
  });

  const projectEvidence = result.analysisEvidence.projectEvidence;
  const definition = projectEvidence.entities.classDefinitions.find(
    (candidate) => candidate.className === "button",
  );
  assert.ok(definition);

  const ownershipId =
    result.analysisEvidence.ownershipInference.indexes.classOwnershipIdsByClassDefinitionId.get(
      definition.id,
    )?.[0];
  assert.ok(ownershipId);
  const ownership =
    result.analysisEvidence.ownershipInference.indexes.classOwnershipById.get(ownershipId);
  assert.ok(ownership);
  assert.equal(ownership.className, "button");
  assert.equal(ownership.consumerSummary.consumerComponentIds.length, 1);
  const ownerCandidate = result.analysisEvidence.ownershipInference.indexes.ownerCandidateById.get(
    ownership.ownerCandidateIds[0],
  );
  assert.equal(ownerCandidate?.ownerKind, "component");
  assert.ok(ownerCandidate?.reasons.includes("single-importing-component"));
  assert.ok(ownerCandidate?.reasons.includes("single-consuming-component"));
});

test("analysis evidence records supplier and emitter for forwarded class props", () => {
  const result = analyzeProjectSourceTexts({
    sourceFiles: [
      {
        filePath: "src/pages/MembersPage.tsx",
        sourceText: [
          'import { Select } from "../components/Select";',
          'export function MembersPage() { return <Select className="members-page__select" />; }',
          "",
        ].join("\n"),
      },
      {
        filePath: "src/components/Select.tsx",
        sourceText:
          "export function Select({ className }) { return <div className={className} />; }\n",
      },
    ],
    selectorCssSources: [
      {
        filePath: "src/pages/MembersPage.css",
        cssText: ".members-page__select { display: block; }\n",
      },
    ],
  });

  const reference = result.analysisEvidence.projectEvidence.entities.classReferences.find(
    (candidate) => candidate.definiteClassNames.includes("members-page__select"),
  );

  assert.ok(reference);
  assert.equal(reference.componentId, "component:src/pages/MembersPage.tsx:MembersPage");
  assert.equal(reference.suppliedByComponentId, "component:src/pages/MembersPage.tsx:MembersPage");
  assert.equal(reference.emittedByComponentId, "component:src/components/Select.tsx:Select");
});

test("analysis evidence records per-class suppliers for merged forwarded class props", () => {
  const result = analyzeProjectSourceTexts({
    sourceFiles: [
      {
        filePath: "src/pages/MembersPage.tsx",
        sourceText: [
          'import { Select } from "../components/Select";',
          'export function MembersPage() { return <Select className="members-page__select" />; }',
          "",
        ].join("\n"),
      },
      {
        filePath: "src/components/Select.tsx",
        sourceText:
          'export function Select({ className }) { return <div className={["select", className].join(" ")} />; }\n',
      },
    ],
    selectorCssSources: [
      {
        filePath: "src/pages/MembersPage.css",
        cssText: ".members-page__select { display: block; }\n",
      },
      {
        filePath: "src/components/Select.css",
        cssText: ".select { display: block; }\n",
      },
    ],
  });

  const reference = result.analysisEvidence.projectEvidence.entities.classReferences.find(
    (candidate) => candidate.definiteClassNames.includes("members-page__select"),
  );

  assert.ok(reference);
  assert.equal(reference.componentId, "component:src/components/Select.tsx:Select");
  assert.equal(reference.suppliedByComponentId, "component:src/components/Select.tsx:Select");
  assert.equal(reference.emittedByComponentId, "component:src/components/Select.tsx:Select");
  assert.equal(
    reference.classNameComponentIds?.["members-page__select"],
    "component:src/pages/MembersPage.tsx:MembersPage",
  );
  assert.equal(
    reference.classNameComponentIds?.select,
    "component:src/components/Select.tsx:Select",
  );
});

test("analysis evidence preserves caller class props through props-object destructuring", () => {
  const result = analyzeProjectSourceTexts({
    sourceFiles: [
      {
        filePath: "src/pages/BrowsePage.tsx",
        sourceText: [
          'import { Button } from "../ui/Button";',
          'export function BrowsePage() { return <Button className="browse-toolbar-button" />; }',
          "",
        ].join("\n"),
      },
      {
        filePath: "src/ui/Button.tsx",
        sourceText: [
          "function joinClasses(...classes) { return classes.filter(Boolean).join(' '); }",
          "export function Button(props) {",
          "  const { className, variant = 'primary' } = props;",
          "  const classes = joinClasses('button', `button--${variant}`, className);",
          "  return <button className={classes}>Save</button>;",
          "}",
          "",
        ].join("\n"),
      },
    ],
    selectorCssSources: [
      {
        filePath: "src/pages/BrowseControls.css",
        cssText: ".browse-toolbar-button { width: 100%; }\n",
      },
      {
        filePath: "src/ui/Button.css",
        cssText: ".button { display: inline-flex; }\n",
      },
    ],
  });

  const reference = result.analysisEvidence.projectEvidence.entities.classReferences.find(
    (candidate) => candidate.definiteClassNames.includes("browse-toolbar-button"),
  );

  assert.ok(reference);
  assert.equal(
    reference.classNameComponentIds?.["browse-toolbar-button"],
    "component:src/pages/BrowsePage.tsx:BrowsePage",
  );
  assert.equal(reference.classNameComponentIds?.button, "component:src/ui/Button.tsx:Button");
});

test("analysis evidence indexes className on unresolved component references", () => {
  const result = analyzeProjectSourceTexts({
    sourceFiles: [
      {
        filePath: "src/SiteHeader.tsx",
        sourceText: [
          'import { Link } from "react-router-dom";',
          'export function SiteHeader() { return <Link to="/" className="site-header__brand">Home</Link>; }',
          "",
        ].join("\n"),
      },
    ],
    selectorCssSources: [
      {
        filePath: "src/SiteHeader.css",
        cssText: ".site-header__brand { font-weight: 700; }\n",
      },
    ],
  });

  const reference = result.analysisEvidence.projectEvidence.entities.classReferences.find(
    (candidate) => candidate.definiteClassNames.includes("site-header__brand"),
  );
  const unsupportedReference =
    result.analysisEvidence.projectEvidence.entities.unsupportedClassReferences.find(
      (candidate) => candidate.rawExpressionText === '"site-header__brand"',
    );

  assert.ok(reference);
  assert.equal(reference.componentId, "component:src/SiteHeader.tsx:SiteHeader");
  assert.equal(reference.emittedByComponentId, "component:src/SiteHeader.tsx:SiteHeader");
  assert.equal(reference.emittedElementLocation?.startLine, 2);
  assert.equal(unsupportedReference, undefined);
});

test("analysis evidence resolves subtree prop identifiers inside nullish fallback branches", () => {
  const result = analyzeProjectSourceTexts({
    sourceFiles: [
      {
        filePath: "src/App.tsx",
        sourceText: [
          'import { Slot } from "./Slot";',
          "export function App() {",
          '  return <Slot content={<span className="slot-content">Ready</span>} />;',
          "}",
          "",
        ].join("\n"),
      },
      {
        filePath: "src/Slot.tsx",
        sourceText: [
          "export function Slot({ content }) {",
          '  return <section>{content ?? <span className="slot-fallback">Fallback</span>}</section>;',
          "}",
          "",
        ].join("\n"),
      },
    ],
    selectorCssSources: [
      {
        filePath: "src/App.css",
        cssText: ".slot-content { display: inline-flex; }\n.slot-fallback { display: none; }\n",
      },
    ],
  });

  assertIndexedClassReferences(result.analysisEvidence.projectEvidence, [
    "slot-content",
    "slot-fallback",
  ]);
});

test("analysis evidence preserves class expression context across helper-forwarded props", () => {
  const result = analyzeProjectSourceTexts({
    sourceFiles: [
      {
        filePath: "src/App.tsx",
        sourceText: [
          'import { Dropdown } from "./Dropdown";',
          "export function App() {",
          '  return <Dropdown className="site-header__notifications-menu" triggerClassName="site-header__menu-trigger site-header__menu-trigger--round" />;',
          "}",
          "",
        ].join("\n"),
      },
      {
        filePath: "src/Dropdown.tsx",
        sourceText: [
          'import { Popover } from "./Popover";',
          "function joinClasses(...classes) { return classes.filter(Boolean).join(' '); }",
          "export function Dropdown({ className, triggerClassName }) {",
          "  return (",
          "    <Popover",
          "      className={joinClasses('dropdown-menu', className)}",
          "      triggerClassName={triggerClassName}",
          "    />",
          "  );",
          "}",
          "",
        ].join("\n"),
      },
      {
        filePath: "src/Popover.tsx",
        sourceText: [
          "function joinClasses(...classes) { return classes.filter(Boolean).join(' '); }",
          "export function Popover({ className, triggerClassName }) {",
          "  return (",
          "    <div className={joinClasses('popover', className)}>",
          "      <button className={joinClasses('popover__trigger', triggerClassName)} />",
          "    </div>",
          "  );",
          "}",
          "",
        ].join("\n"),
      },
    ],
    selectorCssSources: [
      {
        filePath: "src/App.css",
        cssText: [
          ".site-header__notifications-menu { display: block; }",
          ".site-header__menu-trigger { display: inline-flex; }",
          ".site-header__menu-trigger--round { border-radius: 999px; }",
          ".dropdown-menu { display: contents; }",
          ".popover { position: relative; }",
          ".popover__trigger { display: inline-flex; }",
          "",
        ].join("\n"),
      },
    ],
  });

  assertIndexedClassReferences(result.analysisEvidence.projectEvidence, [
    "site-header__notifications-menu",
    "site-header__menu-trigger",
    "site-header__menu-trigger--round",
    "dropdown-menu",
    "popover",
    "popover__trigger",
  ]);

  const analysis = result.analysisEvidence.projectEvidence;
  const appComponentId = "component:src/App.tsx:App";
  const appSuppliedClasses = [
    "site-header__notifications-menu",
    "site-header__menu-trigger",
    "site-header__menu-trigger--round",
  ];
  for (const className of appSuppliedClasses) {
    const references = getClassReferencesByClassName(analysis, className);
    assert.ok(references.length > 0, `expected references for ${className}`);
    assert.ok(
      references.some(
        (reference) => reference.classNameComponentIds?.[className] === appComponentId,
      ),
      `expected ${className} to preserve App as class supplier`,
    );
    assert.ok(
      references.some(
        (reference) =>
          reference.location.filePath === "src/App.tsx" && reference.location.startLine === 3,
      ),
      `expected ${className} to preserve App source location`,
    );
  }
});

test("analysis evidence preserves finite switch helper classes in filtered class arrays", () => {
  const result = analyzeProjectSourceTexts({
    sourceFiles: [
      {
        filePath: "src/TriStateFilterChip.tsx",
        sourceText: [
          "function getTriStateFilterChipClassName(state) {",
          "  switch (state) {",
          '    case "require": return "browse-filter-chip browse-filter-chip--require";',
          '    case "exclude": return "browse-filter-chip browse-filter-chip--exclude";',
          '    default: return "browse-filter-chip";',
          "  }",
          "}",
          "export function TriStateFilterChip({ state, className }) {",
          '  return <button className={[getTriStateFilterChipClassName(state), className].filter(Boolean).join(" ")} />;',
          "}",
          "",
        ].join("\n"),
      },
    ],
    selectorCssSources: [
      {
        filePath: "src/BrowseControls.css",
        cssText: [
          ".browse-filter-chip { display: inline-flex; }",
          ".browse-filter-chip--require { color: green; }",
          ".browse-filter-chip--exclude { color: red; }",
          "",
        ].join("\n"),
      },
    ],
  });

  assertIndexedClassReferences(result.analysisEvidence.projectEvidence, [
    "browse-filter-chip",
    "browse-filter-chip--require",
    "browse-filter-chip--exclude",
  ]);
});

test("analysis evidence preserves local callback alias class variants", () => {
  const result = analyzeProjectSourceTexts({
    sourceFiles: [
      {
        filePath: "src/HomepageDiscoveryRail.tsx",
        sourceText: [
          "function HomepageDiscoveryCard({ className }) {",
          "  return <article className={className} />;",
          "}",
          "export function HomepageDiscoveryRail({ activeIndex = 0 }) {",
          "  const discovery = { slots: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }] };",
          "  return discovery.slots.map((slot, index) => {",
          "    const isActive = index === activeIndex;",
          "    const cardPositionClass = isActive",
          "      ? 'home-page__discovery-card--active'",
          "      : index < activeIndex",
          "        ? 'home-page__discovery-card--previous'",
          "        : index === activeIndex + 1",
          "          ? 'home-page__discovery-card--next'",
          "          : 'home-page__discovery-card--hidden';",
          "    return <HomepageDiscoveryCard key={slot.id} className={cardPositionClass} />;",
          "  });",
          "}",
          "",
        ].join("\n"),
      },
    ],
    selectorCssSources: [
      {
        filePath: "src/HomepageDiscoveryRail.css",
        cssText: [
          ".home-page__discovery-card--active { display: block; }",
          ".home-page__discovery-card--previous { display: block; }",
          ".home-page__discovery-card--next { display: block; }",
          ".home-page__discovery-card--hidden { display: none; }",
          "",
        ].join("\n"),
      },
    ],
  });

  assertIndexedClassReferences(result.analysisEvidence.projectEvidence, [
    "home-page__discovery-card--active",
    "home-page__discovery-card--previous",
    "home-page__discovery-card--next",
    "home-page__discovery-card--hidden",
  ]);
});

test("analysis evidence prefers callback-local shadowed class bindings over outer bindings", () => {
  const result = analyzeProjectSourceTexts({
    sourceFiles: [
      {
        filePath: "src/ShadowedClasses.tsx",
        sourceText: [
          "export function ShadowedClasses({ items = [1] }) {",
          '  const className = "outer";',
          "  return items.map(() => {",
          '    const className = "inner";',
          "    return <div className={className} />;",
          "  });",
          "}",
          "",
        ].join("\n"),
      },
    ],
    selectorCssSources: [
      {
        filePath: "src/ShadowedClasses.css",
        cssText: [".outer { color: red; }", ".inner { color: blue; }", ""].join("\n"),
      },
    ],
  });

  assertIndexedClassReferences(result.analysisEvidence.projectEvidence, ["inner"]);
  assertNoIndexedClassReferences(result.analysisEvidence.projectEvidence, ["outer"]);
});

test("analysis evidence does not index class references from unconsumed shadowed children", () => {
  const result = analyzeProjectSourceTexts({
    sourceFiles: [
      {
        filePath: "src/FieldList.tsx",
        sourceText: [
          'import { Children } from "react";',
          "export function FieldList({ children }) {",
          "  return <div>{Children.map([1], (children) => children)}</div>;",
          "}",
          "export function App() {",
          "  return (",
          "    <FieldList>",
          '      <span className="field-list__slot" />',
          "    </FieldList>",
          "  );",
          "}",
          "",
        ].join("\n"),
      },
    ],
    selectorCssSources: [
      {
        filePath: "src/FieldList.css",
        cssText: ".field-list__slot { display: block; }\n",
      },
    ],
  });

  assertNoIndexedClassReferences(result.analysisEvidence.projectEvidence, ["field-list__slot"]);
});

test("analysis evidence indexes React child transform references by class name", () => {
  const result = analyzeProjectSourceTexts({
    sourceFiles: [
      {
        filePath: "src/FieldList.tsx",
        sourceText: [
          'import { Children, cloneElement } from "react";',
          "function joinClasses(...classes) { return classes.filter(Boolean).join(' '); }",
          "export function FieldList({ children }) {",
          "  return Children.map(children, (child) =>",
          "    cloneElement(child, {",
          '      className: joinClasses(child.props.className, "field-list__control"),',
          "    }),",
          "  );",
          "}",
          "export function App() {",
          "  return (",
          "    <FieldList>",
          '      <input className="invite-form__email" />',
          '      <textarea className="invite-form__message" />',
          "    </FieldList>",
          "  );",
          "}",
          "",
        ].join("\n"),
      },
    ],
    selectorCssSources: [
      {
        filePath: "src/FieldList.css",
        cssText: [
          ".field-list__control { display: block; }",
          ".invite-form__email { inline-size: 100%; }",
          ".invite-form__message { min-height: 8rem; }",
          "",
        ].join("\n"),
      },
    ],
  });

  assertIndexedClassReferences(result.analysisEvidence.projectEvidence, [
    "field-list__control",
    "invite-form__email",
    "invite-form__message",
  ]);
});

test("analysis evidence treats React child guard APIs as non-rendering", () => {
  const result = analyzeProjectSourceTexts({
    sourceFiles: [
      {
        filePath: "src/GuardOnly.tsx",
        sourceText: [
          'import { Children, isValidElement } from "react";',
          "export function GuardOnly({ children }) {",
          "  const count = Children.count(children);",
          "  Children.forEach(children, () => undefined);",
          "  if (!isValidElement(children)) {",
          "    return null;",
          "  }",
          '  return <div className="guard-only">{count}</div>;',
          "}",
          "export function App() {",
          '  return <GuardOnly><span className="child-only" /></GuardOnly>;',
          "}",
          "",
        ].join("\n"),
      },
    ],
    selectorCssSources: [
      {
        filePath: "src/GuardOnly.css",
        cssText: ".guard-only { display: block; }\n.child-only { display: block; }\n",
      },
    ],
  });

  assertIndexedClassReferences(result.analysisEvidence.projectEvidence, ["guard-only"]);
  assertNoIndexedClassReferences(result.analysisEvidence.projectEvidence, ["child-only"]);
});

test("analysis evidence keeps unbounded cloneElement className values uncertain", () => {
  const result = analyzeProjectSourceTexts({
    sourceFiles: [
      {
        filePath: "src/DynamicClone.tsx",
        sourceText: [
          'import { Children, cloneElement } from "react";',
          "export function DynamicClone({ children, tone }) {",
          "  const child = Children.only(children);",
          "  return cloneElement(child, {",
          "    className: `field-list__${tone}`,",
          "  });",
          "}",
          "export function App() {",
          '  return <DynamicClone tone={window.location.hash}><input className="stable-child" /></DynamicClone>;',
          "}",
          "",
        ].join("\n"),
      },
    ],
    selectorCssSources: [
      {
        filePath: "src/DynamicClone.css",
        cssText: ".stable-child { display: block; }\n.field-list__control { display: block; }\n",
      },
    ],
  });

  assertNoIndexedClassReferences(result.analysisEvidence.projectEvidence, ["field-list__control"]);
  assert.ok(
    result.analysisEvidence.projectEvidence.entities.classReferences.some(
      (reference) =>
        reference.unknownDynamic &&
        reference.definiteClassNames.length === 0 &&
        reference.possibleClassNames.length === 0,
    ),
  );
});

test("analysis evidence preserves distinct same-name component identities across expansion chains", () => {
  const result = analyzeProjectSourceTexts({
    sourceFiles: [
      {
        filePath: "src/App.tsx",
        sourceText: [
          'import { Button } from "./outer/Button";',
          "export function App() { return <Button />; }",
          "",
        ].join("\n"),
      },
      {
        filePath: "src/outer/Button.tsx",
        sourceText: [
          'import { Button as InnerButton } from "../inner/Button";',
          'export function Button() { return <section className="outer"><InnerButton /></section>; }',
          "",
        ].join("\n"),
      },
      {
        filePath: "src/inner/Button.tsx",
        sourceText: 'export function Button() { return <span className="inner" />; }\n',
      },
    ],
    selectorCssSources: [
      {
        filePath: "src/App.css",
        cssText: ".outer { display: block; }\n.inner { display: inline; }\n",
      },
    ],
  });

  const analysis = result.analysisEvidence.projectEvidence;
  const outerButton = analysis.entities.components.find(
    (component) =>
      component.filePath === "src/outer/Button.tsx" && component.componentName === "Button",
  );
  const innerButton = analysis.entities.components.find(
    (component) =>
      component.filePath === "src/inner/Button.tsx" && component.componentName === "Button",
  );

  assert.ok(outerButton);
  assert.ok(innerButton);
  assert.notEqual(outerButton.componentKey, innerButton.componentKey);

  assert.ok(
    analysis.relations.componentRenders.some(
      (relation) =>
        relation.fromComponentId === "component:src/App.tsx:App" &&
        relation.toComponentId === outerButton.id,
    ),
  );
  assert.ok(
    analysis.relations.componentRenders.some(
      (relation) =>
        relation.fromComponentId === outerButton.id && relation.toComponentId === innerButton.id,
    ),
  );
});

function assertIndexedClassReferences(analysis, classNames) {
  for (const className of classNames) {
    assert.ok(
      (analysis.indexes.classReferenceIdsByClassName.get(className) ?? []).length > 0,
      `expected classReferenceIdsByClassName to contain ${className}`,
    );
  }
}

function assertNoIndexedClassReferences(analysis, classNames) {
  for (const className of classNames) {
    assert.deepEqual(
      analysis.indexes.classReferenceIdsByClassName.get(className) ?? [],
      [],
      `expected classReferenceIdsByClassName not to contain ${className}`,
    );
  }
}

function getClassReferencesByClassName(analysis, className) {
  const referenceIds = analysis.indexes.classReferenceIdsByClassName.get(className) ?? [];
  return referenceIds
    .map((referenceId) => analysis.indexes.classReferencesById.get(referenceId))
    .filter(Boolean);
}
