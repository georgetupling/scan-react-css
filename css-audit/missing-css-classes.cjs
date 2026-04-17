#!/usr/bin/env node

const path = require("node:path");
const {
  collectDefinedClasses,
  collectReferencedClasses,
  createCssAuditContext,
} = require("./css-index.cjs");
const { isIgnoredClassName, isStateClassName } = require("./config.cjs");

function buildMissingClassReport(context) {
  const definedClasses = collectDefinedClasses(
    context.allCssFiles,
    context.repoRoot,
  );
  const referencedClasses = collectReferencedClasses(
    context.targetSourceFiles,
    context.repoRoot,
  );
  const results = [];

  for (const reference of referencedClasses.values()) {
    const definition = definedClasses.get(reference.className);
    let category = "defined";
    let reason = null;

    if (isIgnoredClassName(reference.className)) {
      category = "ignored";
      reason = "class matches css-audit ignore list";
    } else if (definition) {
      category = "defined";
    } else if (
      reference.dynamicReferenceCount > 0 &&
      reference.staticReferenceCount === 0 &&
      isStateClassName(reference.className)
    ) {
      category = "dynamic-convention-missing";
      reason = "missing class matches dynamic state convention";
    } else if (
      reference.dynamicReferenceCount > 0 &&
      reference.staticReferenceCount === 0
    ) {
      category = "dynamic-missing";
      reason = "class is only referenced in dynamic className composition";
    } else {
      category = "missing";
      reason = "no matching CSS class definition found";
    }

    results.push({
      className: reference.className,
      category,
      reason,
      staticReferenceCount: reference.staticReferenceCount,
      dynamicReferenceCount: reference.dynamicReferenceCount,
      definitions: definition?.definitions ?? [],
      references: reference.references,
    });
  }

  return results.sort((left, right) => {
    if (left.category !== right.category) {
      const priority = new Map([
        ["missing", 0],
        ["dynamic-missing", 1],
        ["dynamic-convention-missing", 2],
        ["ignored", 3],
        ["defined", 4],
      ]);

      return priority.get(left.category) - priority.get(right.category);
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
  const missingCount = results.filter(
    (result) => result.category === "missing",
  ).length;
  const dynamicMissingCount = results.filter(
    (result) =>
      result.category === "dynamic-missing" ||
      result.category === "dynamic-convention-missing",
  ).length;
  const ignoredCount = results.filter(
    (result) => result.category === "ignored",
  ).length;
  const definedCount =
    results.length - missingCount - dynamicMissingCount - ignoredCount;

  console.log("Missing CSS class scan");
  console.log(
    `- target: ${path.relative(context.repoRoot, context.targetDirectory)}`,
  );
  console.log(`- source files scanned: ${context.targetSourceFiles.length}`);
  console.log(`- referenced classes indexed: ${results.length}`);
  console.log(`- missing: ${missingCount}`);
  console.log(`- dynamic missing: ${dynamicMissingCount}`);
  console.log(`- ignored: ${ignoredCount}`);
  console.log(`- defined: ${definedCount}`);
}

function printResults(results) {
  const interestingResults = results.filter(
    (result) =>
      result.category === "missing" ||
      result.category === "dynamic-missing" ||
      result.category === "dynamic-convention-missing",
  );

  if (interestingResults.length === 0) {
    console.log("\nNo missing CSS class candidates found.");
    return;
  }

  console.log("");

  for (const result of interestingResults) {
    const firstReference = result.references[0];
    console.log(
      `${firstReference.filePath} :: .${result.className} [${result.category}]`,
    );
    console.log(`  static references: ${result.staticReferenceCount}`);
    console.log(`  dynamic references: ${result.dynamicReferenceCount}`);
    if (result.reason) {
      console.log(`  note: ${result.reason}`);
    }

    const uniqueFiles = [
      ...new Set(result.references.map((ref) => ref.filePath)),
    ];
    console.log(`  referenced from: ${uniqueFiles.join(", ")}`);
    console.log("");
  }
}

function runMissingCssClassAudit(options = {}) {
  const context = createCssAuditContext(options);
  return {
    context,
    results: buildMissingClassReport(context),
  };
}

function runCli(argv = process.argv) {
  const options = parseCliArgs(argv);
  const { context, results } = runMissingCssClassAudit(options);

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
  runCli,
  runMissingCssClassAudit,
};
