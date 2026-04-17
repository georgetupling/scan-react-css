#!/usr/bin/env node

const path = require("node:path");
const {
  createCssAuditContext,
  formatContext,
  isSimpleClassSelector,
  parseCssRules,
  selectorToClassName,
  summarizeClassUsage,
} = require("./css-index.cjs");
const fs = require("node:fs");

function buildUnusedClassReport(context) {
  const classes = new Map();

  for (const filePath of context.targetCssFiles) {
    const cssText = fs.readFileSync(filePath, "utf8");
    const rules = parseCssRules(cssText);

    for (const rule of rules) {
      for (const selector of rule.selectors) {
        if (!isSimpleClassSelector(selector)) {
          continue;
        }

        const className = selectorToClassName(selector);
        const entry = classes.get(className) ?? {
          className,
          definitions: [],
        };

        entry.definitions.push({
          filePath,
          selector,
          context: formatContext(rule.context),
        });
        classes.set(className, entry);
      }
    }
  }

  const results = [];

  for (const entry of classes.values()) {
    const usage = summarizeClassUsage(
      entry.className,
      context.sourceFiles,
      context.allCssFiles,
    );
    const definitionCount = entry.definitions.length;
    let category = "used";
    let reason = null;

    if (usage.isIgnoredClassName) {
      category = "ignored";
      reason = "class matches css-audit ignore list";
    } else if (usage.staticReferenceCount > 0) {
      category = "used";
    } else if (usage.conventionCategory === "state") {
      category = "dynamic-convention";
      reason = "class matches dynamic state convention";
    } else if (usage.dynamicReferenceCount > 0) {
      category = "dynamic";
      reason = "class is referenced in dynamic className expressions";
    } else if (usage.hasUnsafeSourceUsage) {
      category = "manual";
      reason = usage.unsafeReason;
    } else if (usage.cssReferenceCount > definitionCount) {
      category = "manual";
      reason = "class is referenced by other CSS selectors";
    } else {
      category = "unused";
      reason = "no static source references found";
    }

    results.push({
      className: entry.className,
      definitions: entry.definitions.map((definition) => ({
        filePath: path.relative(context.repoRoot, definition.filePath),
        selector: definition.selector,
        context: definition.context,
      })),
      definitionCount,
      cssReferenceCount: usage.cssReferenceCount,
      staticReferenceCount: usage.staticReferenceCount,
      dynamicReferenceCount: usage.dynamicReferenceCount,
      category,
      reason,
    });
  }

  return results.sort((left, right) => {
    if (left.category !== right.category) {
      const priority = new Map([
        ["unused", 0],
        ["manual", 1],
        ["dynamic", 2],
        ["dynamic-convention", 3],
        ["ignored", 4],
        ["used", 5],
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
  const unusedCount = results.filter(
    (result) => result.category === "unused",
  ).length;
  const manualCount = results.filter(
    (result) => result.category === "manual",
  ).length;
  const dynamicCount = results.filter(
    (result) => result.category === "dynamic",
  ).length;
  const dynamicConventionCount = results.filter(
    (result) => result.category === "dynamic-convention",
  ).length;
  const ignoredCount = results.filter(
    (result) => result.category === "ignored",
  ).length;
  const usedCount =
    results.length -
    unusedCount -
    manualCount -
    dynamicCount -
    dynamicConventionCount -
    ignoredCount;

  console.log("Unused CSS class scan");
  console.log(
    `- target: ${path.relative(context.repoRoot, context.targetDirectory)}`,
  );
  console.log(`- css files scanned: ${context.targetCssFiles.length}`);
  console.log(`- classes indexed: ${results.length}`);
  console.log(`- unused: ${unusedCount}`);
  console.log(`- manual: ${manualCount}`);
  console.log(`- dynamic: ${dynamicCount}`);
  console.log(`- dynamic by convention: ${dynamicConventionCount}`);
  console.log(`- ignored: ${ignoredCount}`);
  console.log(`- used: ${usedCount}`);
}

function printResults(results) {
  const interestingResults = results.filter(
    (result) => result.category === "unused" || result.category === "manual",
  );

  if (interestingResults.length === 0) {
    console.log("\nNo unused CSS class candidates found.");
    return;
  }

  console.log("");

  for (const result of interestingResults) {
    const firstDefinition = result.definitions[0];
    console.log(
      `${firstDefinition.filePath} :: .${result.className} [${result.category}]`,
    );
    console.log(`  definitions: ${result.definitionCount}`);
    console.log(`  css references: ${result.cssReferenceCount}`);
    console.log(`  source references: ${result.staticReferenceCount}`);
    if (result.dynamicReferenceCount > 0) {
      console.log(`  dynamic references: ${result.dynamicReferenceCount}`);
    }
    if (result.reason) {
      console.log(`  note: ${result.reason}`);
    }

    if (result.definitions.length > 1) {
      console.log(
        `  contexts: ${result.definitions.map((definition) => definition.context).join(", ")}`,
      );
    } else {
      console.log(`  context: ${firstDefinition.context}`);
    }

    console.log("");
  }
}

function runUnusedCssAudit(options = {}) {
  const context = createCssAuditContext(options);
  return {
    context,
    results: buildUnusedClassReport(context),
  };
}

function runCli(argv = process.argv) {
  const options = parseCliArgs(argv);
  const { context, results } = runUnusedCssAudit(options);

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
  runUnusedCssAudit,
};
