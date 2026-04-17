#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const {
  collectDefinedClasses,
  collectReferencedClasses,
  createCssAuditContext,
} = require("./css-index.cjs");
const { isIgnoredClassName, isStateClassName } = require("./config.cjs");

function normalizePath(filePath) {
  return filePath.replace(/\\/g, "/");
}

function analyzeSourceFile(relativeFilePath) {
  const normalizedPath = normalizePath(relativeFilePath);

  let match = normalizedPath.match(
    /^apps\/loremaster\/client\/src\/pages\/([^/]+)\//,
  );
  if (match) {
    return {
      kind: "page",
      scope: `page:${match[1]}`,
      area: `page:${match[1]}`,
      label: match[1],
    };
  }

  match = normalizedPath.match(
    /^apps\/loremaster\/client\/src\/features\/([^/]+)\/components\/([^/.]+)/,
  );
  if (match) {
    return {
      kind: "feature-component",
      scope: `feature-component:${match[1]}/${match[2]}`,
      area: `feature:${match[1]}`,
      label: `${match[1]}/${match[2]}`,
    };
  }

  match = normalizedPath.match(
    /^apps\/loremaster\/client\/src\/features\/([^/]+)\//,
  );
  if (match) {
    return {
      kind: "feature",
      scope: `feature:${match[1]}`,
      area: `feature:${match[1]}`,
      label: match[1],
    };
  }

  match = normalizedPath.match(/^apps\/loremaster\/client\/src\/ui\/([^/]+)\//);
  if (match) {
    return {
      kind: "ui-component",
      scope: `ui:${match[1]}`,
      area: "ui",
      label: match[1],
    };
  }

  if (normalizedPath.startsWith("apps/loremaster/client/src/styles/")) {
    return {
      kind: "shared-style-consumer",
      scope: `shared:${path.basename(normalizedPath)}`,
      area: "shared",
      label: path.basename(normalizedPath),
    };
  }

  return {
    kind: "other",
    scope: `other:${normalizedPath}`,
    area: "other",
    label: normalizedPath,
  };
}

function hasSiblingComponent(repoRoot, relativeCssPath, baseName) {
  const cssDirectory = path.dirname(path.join(repoRoot, relativeCssPath));
  const candidateExtensions = [".tsx", ".ts", ".jsx", ".js"];

  return candidateExtensions.some((extension) =>
    fs.existsSync(path.join(cssDirectory, `${baseName}${extension}`)),
  );
}

function analyzeDefinitionFile(repoRoot, relativeFilePath) {
  const normalizedPath = normalizePath(relativeFilePath);

  if (normalizedPath.startsWith("apps/loremaster/client/src/styles/")) {
    return {
      kind: "shared-style",
      scope: `shared-style:${path.basename(normalizedPath, ".css")}`,
      area: "shared",
      label: path.basename(normalizedPath),
    };
  }

  let match = normalizedPath.match(
    /^apps\/loremaster\/client\/src\/pages\/([^/]+)\/([^/.]+)\.css$/,
  );
  if (match) {
    return {
      kind: "page-css",
      scope: `page:${match[1]}`,
      area: `page:${match[1]}`,
      label: `${match[1]}/${match[2]}.css`,
    };
  }

  match = normalizedPath.match(
    /^apps\/loremaster\/client\/src\/features\/([^/]+)\/components\/([^/.]+)\.css$/,
  );
  if (match) {
    const feature = match[1];
    const baseName = match[2];
    const kind = hasSiblingComponent(repoRoot, relativeFilePath, baseName)
      ? "component-css"
      : "feature-shared-css";

    return {
      kind,
      scope:
        kind === "component-css"
          ? `feature-component:${feature}/${baseName}`
          : `feature-shared:${feature}/${baseName}`,
      area: `feature:${feature}`,
      label: `${feature}/${baseName}.css`,
    };
  }

  match = normalizedPath.match(
    /^apps\/loremaster\/client\/src\/features\/([^/]+)\//,
  );
  if (match) {
    return {
      kind: "feature-shared-css",
      scope: `feature-shared:${match[1]}/${path.basename(normalizedPath, ".css")}`,
      area: `feature:${match[1]}`,
      label: normalizedPath,
    };
  }

  match = normalizedPath.match(
    /^apps\/loremaster\/client\/src\/ui\/([^/]+)\/([^/.]+)\.css$/,
  );
  if (match) {
    return {
      kind: "component-css",
      scope: `ui:${match[1]}`,
      area: "ui",
      label: `${match[1]}/${match[2]}.css`,
    };
  }

  return {
    kind: "other-css",
    scope: `other:${normalizedPath}`,
    area: "other",
    label: normalizedPath,
  };
}

function uniqueValues(items) {
  return [...new Set(items)];
}

function classifyOwnership(context, classDefinition, referenceEntry) {
  if (isStateClassName(classDefinition.className)) {
    return {
      category: "ignored",
      reason: "class matches css-audit state-class convention",
    };
  }

  if (isIgnoredClassName(classDefinition.className)) {
    return {
      category: "ignored",
      reason: "class matches css-audit ignore list",
    };
  }

  const definitionFiles = uniqueValues(
    classDefinition.definitions.map((definition) => definition.filePath),
  );
  const definitionAnalyses = definitionFiles.map((filePath) =>
    analyzeDefinitionFile(context.repoRoot, filePath),
  );
  const definitionKinds = uniqueValues(
    definitionAnalyses.map((analysis) => analysis.kind),
  );

  if (definitionKinds.length !== 1) {
    return {
      category: "manual",
      reason: "class is defined across multiple ownership tiers",
    };
  }

  const definitionKind = definitionKinds[0];
  const referenceFiles = uniqueValues(
    (referenceEntry?.references ?? []).map((reference) => reference.filePath),
  );
  const referenceAnalyses = referenceFiles.map((filePath) =>
    analyzeSourceFile(filePath),
  );
  const referenceScopes = uniqueValues(
    referenceAnalyses.map((analysis) => analysis.scope),
  );

  if (referenceScopes.length === 0) {
    return {
      category: "manual",
      reason: "class has no source references; check unused CSS audit instead",
    };
  }

  if (definitionKind === "shared-style") {
    return referenceScopes.length <= 1
      ? {
          category: "shared-style-not-shared",
          reason:
            "class lives in client/styles but is only used by one ownership scope",
        }
      : {
          category: "shared-style-ok",
          reason: null,
        };
  }

  if (definitionKind === "page-css") {
    return referenceScopes.length === 1 &&
      referenceAnalyses[0] &&
      (referenceAnalyses[0].kind === "feature-component" ||
        referenceAnalyses[0].kind === "ui-component")
      ? {
          category: "page-style-used-by-single-component",
          reason: "page CSS is only used by one component scope",
        }
      : {
          category: "page-owned-ok",
          reason: null,
        };
  }

  if (definitionKind === "component-css") {
    const ownerScope = definitionAnalyses[0].scope;
    return referenceScopes.length === 1 && referenceScopes[0] === ownerScope
      ? {
          category: "component-style-local",
          reason: null,
        }
      : {
          category: "component-style-cross-component",
          reason:
            "component CSS is referenced outside its owning component scope",
        };
  }

  if (definitionKind === "feature-shared-css") {
    return {
      category: "feature-shared-ok",
      reason: null,
    };
  }

  return {
    category: "manual",
    reason: "unsupported CSS ownership tier",
  };
}

function buildOwnershipReport(context) {
  const definedClasses = collectDefinedClasses(
    context.targetCssFiles,
    context.repoRoot,
  );
  const referencedClasses = collectReferencedClasses(
    context.sourceFiles,
    context.repoRoot,
  );
  const results = [];

  for (const definition of definedClasses.values()) {
    const referenceEntry = referencedClasses.get(definition.className) ?? null;
    const classification = classifyOwnership(
      context,
      definition,
      referenceEntry,
    );

    results.push({
      className: definition.className,
      category: classification.category,
      reason: classification.reason,
      definitions: definition.definitions,
      referenceFiles: uniqueValues(
        (referenceEntry?.references ?? []).map(
          (reference) => reference.filePath,
        ),
      ),
      referenceCount: referenceEntry
        ? referenceEntry.staticReferenceCount +
          referenceEntry.dynamicReferenceCount
        : 0,
    });
  }

  return results.sort((left, right) => {
    if (left.category !== right.category) {
      const priority = new Map([
        ["shared-style-not-shared", 0],
        ["page-style-used-by-single-component", 1],
        ["component-style-cross-component", 2],
        ["manual", 3],
        ["ignored", 4],
        ["component-style-local", 5],
        ["feature-shared-ok", 6],
        ["page-owned-ok", 7],
        ["shared-style-ok", 8],
      ]);

      return (
        (priority.get(left.category) ?? 99) -
        (priority.get(right.category) ?? 99)
      );
    }

    return left.className.localeCompare(right.className);
  });
}

function parseCliArgs(argv) {
  const args = argv.slice(2);
  const targetArg = args.find((arg) => !arg.startsWith("--"));

  return {
    targetDirectory: targetArg,
    shouldJson: args.includes("--json"),
  };
}

function printSummary(context, results) {
  const flaggedCount = results.filter((result) =>
    [
      "shared-style-not-shared",
      "page-style-used-by-single-component",
      "component-style-cross-component",
      "manual",
    ].includes(result.category),
  ).length;

  console.log("CSS ownership scan");
  console.log(
    `- target: ${path.relative(context.repoRoot, context.targetDirectory)}`,
  );
  console.log(`- css classes analyzed: ${results.length}`);
  console.log(`- flagged: ${flaggedCount}`);
}

function printResults(results) {
  const interestingResults = results.filter((result) =>
    [
      "shared-style-not-shared",
      "page-style-used-by-single-component",
      "component-style-cross-component",
      "manual",
    ].includes(result.category),
  );

  if (interestingResults.length === 0) {
    console.log("\nNo CSS ownership candidates found.");
    return;
  }

  console.log("");

  for (const result of interestingResults) {
    const firstDefinition = result.definitions[0];
    console.log(
      `${firstDefinition.filePath} :: .${result.className} [${result.category}]`,
    );
    console.log(`  references: ${result.referenceCount}`);
    if (result.reason) {
      console.log(`  note: ${result.reason}`);
    }
    if (result.referenceFiles.length > 0) {
      console.log(`  referenced from: ${result.referenceFiles.join(", ")}`);
    }
    console.log("");
  }
}

function runOwnershipAudit(options = {}) {
  const context = createCssAuditContext(options);
  return {
    context,
    results: buildOwnershipReport(context),
  };
}

function runCli(argv = process.argv) {
  const options = parseCliArgs(argv);
  const { context, results } = runOwnershipAudit(options);

  if (options.shouldJson) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  printSummary(context, results);
  printResults(results);
}

if (require.main === module) {
  try {
    runCli();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  analyzeDefinitionFile,
  analyzeSourceFile,
  runCli,
  runOwnershipAudit,
};
