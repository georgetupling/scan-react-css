#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const {
  createCssAuditContext,
  declarationsToObject,
  findClassOccurrences,
  findStaticClassAttributeMatches,
  formatContext,
  isSimpleClassSelector,
  parseCssRules,
  selectorToClassName,
  summarizeClassUsage,
} = require("./css-index.cjs");

const SAFE_UTILITY_EXTRAS = new Map([["min-width", "0"]]);

function buildUtilityIndex(layoutCssPath) {
  const cssText = fs.readFileSync(layoutCssPath, "utf8");
  const rules = parseCssRules(cssText);
  const utilities = [];

  for (const rule of rules) {
    if (rule.context.length > 0) {
      continue;
    }

    for (const selector of rule.selectors) {
      if (!isSimpleClassSelector(selector)) {
        continue;
      }

      utilities.push({
        selector,
        className: selectorToClassName(selector),
        declarations: rule.declarations,
      });
    }
  }

  return utilities;
}

function hasUnsafeExtraDeclarations(utilityDeclarations, targetDeclarations) {
  for (const [property, utilityValue] of utilityDeclarations.entries()) {
    if (targetDeclarations.has(property)) {
      if (targetDeclarations.get(property) !== utilityValue) {
        return true;
      }

      continue;
    }

    const safeValue = SAFE_UTILITY_EXTRAS.get(property);
    if (safeValue === utilityValue) {
      continue;
    }

    return true;
  }

  return false;
}

function sortUtilityCandidates(utilities) {
  return [...utilities].sort((left, right) => {
    if (left.declarations.size !== right.declarations.size) {
      return left.declarations.size - right.declarations.size;
    }

    return left.className.localeCompare(right.className);
  });
}

function findUtilityCombination(targetDeclarations, utilities) {
  const candidateUtilities = sortUtilityCandidates(
    utilities.filter(
      (utility) =>
        !hasUnsafeExtraDeclarations(utility.declarations, targetDeclarations),
    ),
  );

  let bestMatch = null;

  function search(startIndex, chosenUtilities, coveredDeclarations) {
    if (coveredDeclarations.size === targetDeclarations.size) {
      const candidate = {
        classes: chosenUtilities.map((utility) => utility.className),
      };

      if (
        bestMatch === null ||
        candidate.classes.length < bestMatch.classes.length ||
        (candidate.classes.length === bestMatch.classes.length &&
          candidate.classes
            .join(" ")
            .localeCompare(bestMatch.classes.join(" ")) < 0)
      ) {
        bestMatch = candidate;
      }

      return;
    }

    if (bestMatch && chosenUtilities.length >= bestMatch.classes.length) {
      return;
    }

    for (
      let index = startIndex;
      index < candidateUtilities.length;
      index += 1
    ) {
      const utility = candidateUtilities[index];
      let addsCoverage = false;
      const nextCovered = new Map(coveredDeclarations);

      for (const [property, value] of utility.declarations.entries()) {
        const targetValue = targetDeclarations.get(property);

        if (targetValue === undefined || targetValue !== value) {
          continue;
        }

        if (!nextCovered.has(property)) {
          nextCovered.set(property, value);
          addsCoverage = true;
        }
      }

      if (!addsCoverage) {
        continue;
      }

      search(index + 1, [...chosenUtilities, utility], nextCovered);
    }
  }

  search(0, [], new Map());
  return bestMatch;
}

function replaceClassTokenList(
  attributeValue,
  oldClassName,
  replacementClasses,
) {
  const existingClasses = attributeValue
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

  const nextClasses = existingClasses.filter((token) => token !== oldClassName);

  for (const utilityClass of replacementClasses) {
    if (!nextClasses.includes(utilityClass)) {
      nextClasses.push(utilityClass);
    }
  }

  return nextClasses.join(" ");
}

function applySourceFileReplacements(filePath, className, replacementClasses) {
  const originalContent = fs.readFileSync(filePath, "utf8");
  let nextContent = originalContent;
  const attributeMatches = findStaticClassAttributeMatches(
    originalContent,
  ).sort((left, right) => right.start - left.start);

  for (const attributeMatch of attributeMatches) {
    if (findClassOccurrences(attributeMatch.value, className).length === 0) {
      continue;
    }

    const nextValue = replaceClassTokenList(
      attributeMatch.value,
      className,
      replacementClasses,
    );

    nextContent =
      nextContent.slice(0, attributeMatch.start) +
      nextValue +
      nextContent.slice(attributeMatch.end);
  }

  if (nextContent !== originalContent) {
    fs.writeFileSync(filePath, nextContent);
  }
}

function removeCssRules(filePath, deletions) {
  const originalContent = fs.readFileSync(filePath, "utf8");
  let nextContent = originalContent;
  const sortedDeletions = [...deletions].sort(
    (left, right) => right.start - left.start,
  );

  for (const deletion of sortedDeletions) {
    nextContent =
      nextContent.slice(0, deletion.start) + nextContent.slice(deletion.end);
  }

  if (nextContent !== originalContent) {
    fs.writeFileSync(filePath, nextContent);
  }
}

function countDefinitionsForClass(rules, className) {
  return rules.reduce((count, rule) => {
    return (
      count +
      rule.selectors.filter(
        (selector) =>
          isSimpleClassSelector(selector) &&
          selectorToClassName(selector) === className,
      ).length
    );
  }, 0);
}

function buildSuggestions(context, utilities) {
  const suggestions = [];
  const targetCssFiles = context.targetCssFiles.filter(
    (filePath) => path.resolve(filePath) !== path.resolve(context.layoutsPath),
  );

  for (const filePath of targetCssFiles) {
    const cssText = fs.readFileSync(filePath, "utf8");
    const rules = parseCssRules(cssText);

    for (const rule of rules) {
      for (const selector of rule.selectors) {
        if (!isSimpleClassSelector(selector) || rule.declarations.size === 0) {
          continue;
        }

        const match = findUtilityCombination(rule.declarations, utilities);
        if (!match) {
          continue;
        }

        const className = selectorToClassName(selector);
        const usage = summarizeClassUsage(
          className,
          context.sourceFiles,
          context.allCssFiles,
        );
        const definitionCount = countDefinitionsForClass(rules, className);

        let category = "manual";
        let reason = usage.hasUnsafeSourceUsage ? usage.unsafeReason : null;

        if (!reason && rule.context.length > 0) {
          reason = "rule is nested under at-rule context";
        }

        if (!reason && rule.selectors.length !== 1) {
          reason = "rule is part of a multi-selector block";
        }

        if (!reason && usage.cssReferenceCount !== definitionCount) {
          reason = "class is referenced by other CSS selectors";
        }

        if (!reason) {
          category = "safe";
        }

        suggestions.push({
          filePath,
          selector,
          className,
          context: formatContext(rule.context),
          classes: match.classes,
          declarations: declarationsToObject(rule.declarations),
          category,
          reason,
          start: rule.start,
          end: rule.end,
          sourceUsageByFile: usage.sourceUsageByFile,
        });
      }
    }
  }

  return suggestions.sort((left, right) => {
    if (left.category !== right.category) {
      return left.category === "safe" ? -1 : 1;
    }

    const fileComparison = left.filePath.localeCompare(right.filePath);
    if (fileComparison !== 0) {
      return fileComparison;
    }

    return left.selector.localeCompare(right.selector);
  });
}

function printSummary(context, suggestions) {
  const safeCount = suggestions.filter(
    (suggestion) => suggestion.category === "safe",
  ).length;
  const manualCount = suggestions.length - safeCount;

  console.log("Layout utility replacement scan");
  console.log(
    `- target: ${path.relative(context.repoRoot, context.targetDirectory)}`,
  );
  console.log(
    `- layouts: ${path.relative(context.repoRoot, context.layoutsPath)}`,
  );
  console.log(`- css files scanned: ${context.targetCssFiles.length}`);
  console.log(`- suggestions: ${suggestions.length}`);
  console.log(`- safe: ${safeCount}`);
  console.log(`- manual: ${manualCount}`);
}

function printSuggestions(context, suggestions) {
  if (suggestions.length === 0) {
    console.log("\nNo replacement candidates found.");
    return;
  }

  console.log("");

  for (const suggestion of suggestions) {
    console.log(
      `${path.relative(context.repoRoot, suggestion.filePath)} :: ${suggestion.selector} [${suggestion.category}]`,
    );
    console.log(`  context: ${suggestion.context}`);
    console.log(`  replace with: ${suggestion.classes.join(" ")}`);

    if (suggestion.reason) {
      console.log(`  note: ${suggestion.reason}`);
    }

    console.log(`  declarations: ${JSON.stringify(suggestion.declarations)}`);
    console.log("");
  }
}

function applyFixes(suggestions) {
  const safeSuggestions = suggestions.filter(
    (suggestion) => suggestion.category === "safe",
  );
  const deletionsByCssFile = new Map();
  let fixedCount = 0;

  for (const suggestion of safeSuggestions) {
    for (const [sourceFile] of suggestion.sourceUsageByFile.entries()) {
      applySourceFileReplacements(
        sourceFile,
        suggestion.className,
        suggestion.classes,
      );
    }

    const deletions = deletionsByCssFile.get(suggestion.filePath) ?? [];
    deletions.push({ start: suggestion.start, end: suggestion.end });
    deletionsByCssFile.set(suggestion.filePath, deletions);
    fixedCount += 1;
  }

  for (const [filePath, deletions] of deletionsByCssFile.entries()) {
    removeCssRules(filePath, deletions);
  }

  return fixedCount;
}

function parseCliArgs(argv) {
  const args = argv.slice(2);
  const targetArg = args.find((arg) => !arg.startsWith("--"));
  const layoutsPathArg = args.find((arg) => arg.startsWith("--layouts="));

  return {
    targetDirectory: targetArg,
    layoutsPath: layoutsPathArg
      ? layoutsPathArg.slice("--layouts=".length)
      : undefined,
    shouldFix: args.includes("--fix"),
    shouldJson: args.includes("--json"),
  };
}

function runLayoutReplacementAudit(options = {}) {
  const context = createCssAuditContext(options);

  if (!fs.existsSync(context.layoutsPath)) {
    throw new Error(`layouts.css not found: ${context.layoutsPath}`);
  }

  const utilities = buildUtilityIndex(context.layoutsPath);
  const suggestions = buildSuggestions(context, utilities);

  return {
    context,
    suggestions,
  };
}

function runCli(argv = process.argv) {
  const options = parseCliArgs(argv);
  const { context, suggestions } = runLayoutReplacementAudit(options);

  if (options.shouldJson) {
    console.log(
      JSON.stringify(
        suggestions.map((suggestion) => ({
          filePath: path.relative(context.repoRoot, suggestion.filePath),
          selector: suggestion.selector,
          context: suggestion.context,
          classes: suggestion.classes,
          category: suggestion.category,
          reason: suggestion.reason ?? null,
          declarations: suggestion.declarations,
        })),
        null,
        2,
      ),
    );
    return;
  }

  printSummary(context, suggestions);
  printSuggestions(context, suggestions);

  if (!options.shouldFix) {
    return;
  }

  const fixedCount = applyFixes(suggestions);
  console.log(`Applied fixes for ${fixedCount} safe replacement candidate(s).`);
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
  runLayoutReplacementAudit,
};
