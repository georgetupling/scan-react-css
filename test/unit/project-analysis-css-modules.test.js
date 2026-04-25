import assert from "node:assert/strict";
import test from "node:test";
import { analyzeProjectSourceTexts } from "../../dist/static-analysis-engine.js";

test("ProjectAnalysis records CSS Module imports, member references, and matches", () => {
  const result = analyzeProjectSourceTexts({
    sourceFiles: [
      {
        filePath: "src/Button.tsx",
        sourceText:
          'import styles from "./Button.module.css";\nexport function Button() { return <button className={styles.root}>Button</button>; }\n',
      },
    ],
    selectorCssSources: [
      {
        filePath: "src/Button.module.css",
        cssText: ".root { display: block; }\n",
      },
    ],
  });

  const analysis = result.projectAnalysis;
  const cssModuleImport = analysis.entities.cssModuleImports[0];
  const reference = analysis.entities.cssModuleMemberReferences[0];
  const match = analysis.relations.cssModuleMemberMatches[0];

  assert.equal(cssModuleImport.localName, "styles");
  assert.equal(cssModuleImport.stylesheetFilePath, "src/Button.module.css");
  assert.equal(reference.memberName, "root");
  assert.equal(reference.accessKind, "property");
  assert.equal(match.status, "matched");
  assert.equal(match.definitionId, analysis.entities.classDefinitions[0].id);
  assert.deepEqual(analysis.indexes.cssModuleMemberReferencesByImportId.get(cssModuleImport.id), [
    reference.id,
  ]);
});

test("ProjectAnalysis records missing and computed CSS Module member access", () => {
  const result = analyzeProjectSourceTexts({
    sourceFiles: [
      {
        filePath: "src/Button.tsx",
        sourceText:
          'import styles from "./Button.module.css";\nconst name = "root";\nexport function Button() { return <button className={styles.missing + styles[name]}>Button</button>; }\n',
      },
    ],
    selectorCssSources: [
      {
        filePath: "src/Button.module.css",
        cssText: ".root { display: block; }\n",
      },
    ],
  });

  const analysis = result.projectAnalysis;
  const missingMatch = analysis.relations.cssModuleMemberMatches.find(
    (match) => match.className === "missing",
  );
  const diagnostic = analysis.entities.cssModuleReferenceDiagnostics[0];

  assert.equal(missingMatch?.status, "missing");
  assert.equal(diagnostic.reason, "computed-css-module-member");
  assert.equal(diagnostic.rawExpressionText, "styles[name]");
});
