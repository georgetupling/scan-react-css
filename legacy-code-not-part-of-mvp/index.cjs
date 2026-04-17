#!/usr/bin/env node

const path = require("node:path");
const { aggregateFindings, collectAuditFindings } = require("./findings.cjs");
const { runLayoutReplacementAudit } = require("./layout-replacements.cjs");
const { runMissingCssClassAudit } = require("./missing-css-classes.cjs");
const { runOwnershipAudit } = require("./ownership.cjs");
const { runUnusedCssAudit } = require("./unused-css-classes.cjs");

function parseCliArgs(argv) {
  const args = argv.slice(2);
  const targetArg = args.find((arg) => !arg.startsWith("--"));
  const layoutsPathArg = args.find((arg) => arg.startsWith("--layouts="));

  return {
    targetDirectory: targetArg,
    layoutsPath: layoutsPathArg
      ? layoutsPathArg.slice("--layouts=".length)
      : undefined,
    shouldJson: args.includes("--json"),
  };
}

function runCli(argv = process.argv) {
  const options = parseCliArgs(argv);
  const layoutAudit = runLayoutReplacementAudit(options);
  const unusedAudit = runUnusedCssAudit(options);
  const missingAudit = runMissingCssClassAudit(options);
  const ownershipAudit = runOwnershipAudit(options);
  const findings = collectAuditFindings({
    layoutAudit,
    missingAudit,
    ownershipAudit,
    unusedAudit,
  });
  const aggregatedFindings = aggregateFindings(findings);

  if (options.shouldJson) {
    console.log(
      JSON.stringify(
        {
          findings: aggregatedFindings,
        },
        null,
        2,
      ),
    );
    return;
  }

  const errorCount = aggregatedFindings.filter(
    (entry) => entry.primary.severity === "error",
  ).length;
  const warningCount = aggregatedFindings.filter(
    (entry) => entry.primary.severity === "warning",
  ).length;
  const infoCount = aggregatedFindings.filter(
    (entry) => entry.primary.severity === "info",
  ).length;

  console.log("CSS Audit");
  console.log(
    `- target: ${path.relative(layoutAudit.context.repoRoot, layoutAudit.context.targetDirectory)}`,
  );
  console.log(`- classes with findings: ${aggregatedFindings.length}`);
  console.log(`- errors: ${errorCount}`);
  console.log(`- warnings: ${warningCount}`);
  console.log(`- info: ${infoCount}`);

  if (aggregatedFindings.length === 0) {
    console.log("\nNo CSS audit findings.");
    return;
  }

  console.log("");

  for (const entry of aggregatedFindings) {
    const primaryContext = entry.primary.contexts[0];
    const primaryFilePath = primaryContext?.filePath ?? "(unknown)";
    console.log(
      `${primaryFilePath} :: .${entry.className} [${entry.primary.severity}]`,
    );
    console.log(`  rule: ${entry.primary.ruleId}`);
    console.log(`  note: ${entry.primary.message}`);

    if (entry.primary.metadata.referenceFiles?.length) {
      console.log(
        `  referenced from: ${entry.primary.metadata.referenceFiles.join(", ")}`,
      );
    }

    if (entry.primary.metadata.replacementClasses?.length) {
      console.log(
        `  replace with: ${entry.primary.metadata.replacementClasses.join(" ")}`,
      );
    }

    if (entry.secondary.length > 0) {
      console.log(
        `  secondary: ${entry.secondary.map((finding) => finding.ruleId).join(", ")}`,
      );
    }

    console.log("");
  }
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
};
