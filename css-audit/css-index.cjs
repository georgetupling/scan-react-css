const fs = require("node:fs");
const path = require("node:path");
const { isIgnoredClassName, isStateClassName } = require("./config.cjs");

const SOURCE_EXTENSIONS = new Set([".tsx", ".ts", ".jsx", ".js", ".html"]);
const CSS_EXTENSION = ".css";

function stripComments(cssText) {
  return cssText.replace(/\/\*[\s\S]*?\*\//g, "");
}

function advancePastWhitespaceAndComments(text, startIndex) {
  let index = startIndex;

  while (index < text.length) {
    while (index < text.length && /\s/.test(text[index])) {
      index += 1;
    }

    if (text[index] === "/" && text[index + 1] === "*") {
      const commentEnd = text.indexOf("*/", index + 2);
      return advancePastWhitespaceAndComments(
        text,
        commentEnd < 0 ? text.length : commentEnd + 2,
      );
    }

    break;
  }

  return index;
}

function findNextOpenBrace(text, startIndex) {
  let index = startIndex;

  while (index < text.length) {
    if (text[index] === "/" && text[index + 1] === "*") {
      const commentEnd = text.indexOf("*/", index + 2);
      if (commentEnd < 0) {
        return -1;
      }

      index = commentEnd + 2;
      continue;
    }

    if (text[index] === "{") {
      return index;
    }

    index += 1;
  }

  return -1;
}

function findRuleEnd(text, openBraceIndex) {
  let depth = 1;
  let cursor = openBraceIndex + 1;

  while (cursor < text.length && depth > 0) {
    if (text[cursor] === "/" && text[cursor + 1] === "*") {
      const commentEnd = text.indexOf("*/", cursor + 2);
      if (commentEnd < 0) {
        return text.length;
      }

      cursor = commentEnd + 2;
      continue;
    }

    if (text[cursor] === "{") {
      depth += 1;
    } else if (text[cursor] === "}") {
      depth -= 1;
    }

    cursor += 1;
  }

  return cursor;
}

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeDeclarationValue(_property, rawValue) {
  return normalizeWhitespace(rawValue)
    .replace(/\bstart\b/g, "flex-start")
    .replace(/\bend\b/g, "flex-end");
}

function parseDeclarations(blockText) {
  const declarations = new Map();
  const chunks = blockText.split(";");

  for (const chunk of chunks) {
    const separatorIndex = chunk.indexOf(":");
    if (separatorIndex < 0) {
      continue;
    }

    const property = normalizeWhitespace(
      chunk.slice(0, separatorIndex),
    ).toLowerCase();
    const value = normalizeDeclarationValue(
      property,
      chunk.slice(separatorIndex + 1),
    );

    if (!property || !value) {
      continue;
    }

    declarations.set(property, value);
  }

  return declarations;
}

function isSimpleClassSelector(selector) {
  return /^\.[A-Za-z0-9_-]+$/.test(selector.trim());
}

function selectorToClassName(selector) {
  return selector.trim().slice(1);
}

function extractClassNamesFromSelector(selector) {
  const leadingSelector = selector
    .trim()
    .split(/\s+|>|\+|~/)[0]
    .trim();
  const classNames = [];
  const pattern = /\.([A-Za-z0-9_-]+)/g;
  let match = pattern.exec(leadingSelector);

  while (match) {
    classNames.push(match[1]);
    match = pattern.exec(leadingSelector);
  }

  return classNames;
}

function parseCssRules(cssText, context = [], baseOffset = 0) {
  const rules = [];
  let index = 0;

  while (index < cssText.length) {
    index = advancePastWhitespaceAndComments(cssText, index);

    if (index >= cssText.length) {
      break;
    }

    const ruleStart = index;
    const openBraceIndex = findNextOpenBrace(cssText, index);
    if (openBraceIndex < 0) {
      break;
    }

    const prelude = stripComments(cssText.slice(index, openBraceIndex)).trim();
    const cursor = findRuleEnd(cssText, openBraceIndex);
    const blockText = cssText.slice(openBraceIndex + 1, cursor - 1);

    if (prelude.startsWith("@")) {
      const nestedContext = [...context, prelude];
      rules.push(
        ...parseCssRules(
          blockText,
          nestedContext,
          baseOffset + openBraceIndex + 1,
        ),
      );
    } else {
      const selectors = prelude
        .split(",")
        .map((selector) => selector.trim())
        .filter(Boolean);

      rules.push({
        selectors,
        declarations: parseDeclarations(blockText),
        context,
        prelude,
        start: baseOffset + ruleStart,
        end: baseOffset + cursor,
      });
    }

    index = cursor;
  }

  return rules;
}

function collectFiles(directoryPath, extensionFilter) {
  const files = [];
  const entries = fs.readdirSync(directoryPath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === "dist") {
      continue;
    }

    const entryPath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectFiles(entryPath, extensionFilter));
      continue;
    }

    if (
      entry.isFile() &&
      extensionFilter(path.extname(entry.name).toLowerCase())
    ) {
      files.push(entryPath);
    }
  }

  return files;
}

function declarationsToObject(declarations) {
  return Object.fromEntries(declarations.entries());
}

function formatContext(context) {
  return context.length === 0 ? "root" : context.join(" -> ");
}

function countCssSelectorReferences(cssFiles, className) {
  const pattern = new RegExp(`\\.${className}(?![A-Za-z0-9_-])`, "g");
  let count = 0;

  for (const filePath of cssFiles) {
    const cssText = fs.readFileSync(filePath, "utf8");
    const matches = cssText.match(pattern);
    if (matches) {
      count += matches.length;
    }
  }

  return count;
}

function findStaticClassAttributeMatches(content) {
  const matches = [];
  const patterns = [
    /\bclass(Name)?\s*=\s*"([^"]*)"/g,
    /\bclass(Name)?\s*=\s*'([^']*)'/g,
    /\bclassName\s*=\s*\{\s*"([^"]*)"\s*\}/g,
    /\bclassName\s*=\s*\{\s*'([^']*)'\s*\}/g,
    /\bclassName\s*=\s*\{\s*`([^`$]*)`\s*\}/g,
  ];

  for (const pattern of patterns) {
    let match = pattern.exec(content);
    while (match) {
      const attributeValue = match[2] ?? match[1] ?? "";
      const valueStart = match.index + match[0].indexOf(attributeValue);
      matches.push({
        start: valueStart,
        end: valueStart + attributeValue.length,
        value: attributeValue,
      });
      match = pattern.exec(content);
    }
  }

  return matches.sort((left, right) => left.start - right.start);
}

function skipQuotedString(text, startIndex, quoteCharacter) {
  let index = startIndex + 1;

  while (index < text.length) {
    if (text[index] === "\\") {
      index += 2;
      continue;
    }

    if (text[index] === quoteCharacter) {
      return index + 1;
    }

    index += 1;
  }

  return text.length;
}

function skipLineComment(text, startIndex) {
  let index = startIndex + 2;

  while (index < text.length && text[index] !== "\n") {
    index += 1;
  }

  return index;
}

function skipBlockComment(text, startIndex) {
  const commentEnd = text.indexOf("*/", startIndex + 2);
  return commentEnd < 0 ? text.length : commentEnd + 2;
}

function skipBalancedJsExpression(text, openBraceIndex) {
  let depth = 1;
  let index = openBraceIndex + 1;

  while (index < text.length && depth > 0) {
    if (text[index] === "'" || text[index] === '"') {
      index = skipQuotedString(text, index, text[index]);
      continue;
    }

    if (text[index] === "`") {
      index = skipTemplateLiteral(text, index);
      continue;
    }

    if (text[index] === "/" && text[index + 1] === "/") {
      index = skipLineComment(text, index);
      continue;
    }

    if (text[index] === "/" && text[index + 1] === "*") {
      index = skipBlockComment(text, index);
      continue;
    }

    if (text[index] === "{") {
      depth += 1;
    } else if (text[index] === "}") {
      depth -= 1;
    }

    index += 1;
  }

  return index;
}

function skipTemplateLiteral(text, startIndex) {
  let index = startIndex + 1;

  while (index < text.length) {
    if (text[index] === "\\") {
      index += 2;
      continue;
    }

    if (text[index] === "`") {
      return index + 1;
    }

    if (text[index] === "$" && text[index + 1] === "{") {
      index = skipBalancedJsExpression(text, index + 1);
      continue;
    }

    index += 1;
  }

  return text.length;
}

function readQuotedString(text, startIndex, quoteCharacter) {
  let index = startIndex + 1;
  let value = "";

  while (index < text.length) {
    if (text[index] === "\\") {
      value += text[index + 1] ?? "";
      index += 2;
      continue;
    }

    if (text[index] === quoteCharacter) {
      return {
        end: index + 1,
        value,
      };
    }

    value += text[index];
    index += 1;
  }

  return {
    end: text.length,
    value,
  };
}

function extractStringLiteralsFromJs(text) {
  const literals = [];
  let index = 0;

  while (index < text.length) {
    if (text[index] === "'" || text[index] === '"') {
      const stringLiteral = readQuotedString(text, index, text[index]);
      literals.push(stringLiteral.value);
      index = stringLiteral.end;
      continue;
    }

    if (text[index] === "`") {
      const templateLiteral = readTemplateLiteral(text, index);
      literals.push(...templateLiteral.literals);
      index = templateLiteral.end;
      continue;
    }

    if (text[index] === "/" && text[index + 1] === "/") {
      index = skipLineComment(text, index);
      continue;
    }

    if (text[index] === "/" && text[index + 1] === "*") {
      index = skipBlockComment(text, index);
      continue;
    }

    index += 1;
  }

  return literals;
}

function readTemplateLiteral(text, startIndex) {
  let index = startIndex + 1;
  let currentLiteral = "";
  const literals = [];

  while (index < text.length) {
    if (text[index] === "\\") {
      currentLiteral += text[index + 1] ?? "";
      index += 2;
      continue;
    }

    if (text[index] === "`") {
      if (currentLiteral.trim()) {
        literals.push(currentLiteral);
      }

      return {
        end: index + 1,
        literals,
      };
    }

    if (text[index] === "$" && text[index + 1] === "{") {
      if (currentLiteral.trim()) {
        literals.push(currentLiteral);
      }

      currentLiteral = "";
      const expressionEnd = skipBalancedJsExpression(text, index + 1);
      const expressionContent = text.slice(index + 2, expressionEnd - 1);
      literals.push(...extractStringLiteralsFromJs(expressionContent));
      index = expressionEnd;
      continue;
    }

    currentLiteral += text[index];
    index += 1;
  }

  if (currentLiteral.trim()) {
    literals.push(currentLiteral);
  }

  return {
    end: text.length,
    literals,
  };
}

function extractClassTokensFromExpression(expressionText) {
  return extractStringLiteralsFromJs(expressionText)
    .flatMap((literal) => literal.split(/\s+/))
    .map((token) => token.trim())
    .filter(Boolean);
}

function isStaticClassExpression(expressionText) {
  const trimmed = expressionText.trim();

  return (
    /^"[^"]*"$/.test(trimmed) ||
    /^'[^']*'$/.test(trimmed) ||
    /^`[^`$]*`$/.test(trimmed)
  );
}

function findDynamicClassExpressionMatches(content) {
  const matches = [];
  const pattern = /\bclass(Name)?\s*=\s*\{/g;
  let match = pattern.exec(content);

  while (match) {
    const openBraceIndex = content.indexOf("{", match.index);
    if (openBraceIndex < 0) {
      break;
    }

    const expressionEnd = skipBalancedJsExpression(content, openBraceIndex);
    const expressionText = content.slice(openBraceIndex + 1, expressionEnd - 1);

    if (!isStaticClassExpression(expressionText)) {
      matches.push({
        start: openBraceIndex + 1,
        end: expressionEnd - 1,
        value: expressionText,
        tokens: extractClassTokensFromExpression(expressionText),
      });
    }

    pattern.lastIndex = expressionEnd;
    match = pattern.exec(content);
  }

  return matches;
}

function findNamedClassValueMatches(content) {
  const matches = [];
  const patterns = [
    /\b[A-Za-z_$][\w$]*ClassName\s*=\s*"([^"]*)"/g,
    /\b[A-Za-z_$][\w$]*ClassName\s*=\s*'([^']*)'/g,
    /\b[A-Za-z_$][\w$]*ClassName\s*:\s*"([^"]*)"/g,
    /\b[A-Za-z_$][\w$]*ClassName\s*:\s*'([^']*)'/g,
  ];

  for (const pattern of patterns) {
    let match = pattern.exec(content);

    while (match) {
      const value = match[1] ?? "";
      const valueStart = match.index + match[0].indexOf(value);
      matches.push({
        start: valueStart,
        end: valueStart + value.length,
        value,
        tokens: value
          .split(/\s+/)
          .map((token) => token.trim())
          .filter(Boolean),
      });
      match = pattern.exec(content);
    }
  }

  return matches.sort((left, right) => left.start - right.start);
}

function findDynamicClassVariableMatches(content, dynamicExpressionMatches) {
  const matches = [];
  const pattern =
    /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*(?:ClassName|Class))\s*=\s*([\s\S]*?);/g;
  let match = pattern.exec(content);

  while (match) {
    const variableName = match[1];
    const value = match[2] ?? "";
    const usedInClassName = dynamicExpressionMatches.some((expression) =>
      new RegExp(`\\b${variableName}\\b`).test(expression.value),
    );

    if (!usedInClassName) {
      match = pattern.exec(content);
      continue;
    }

    const valueStart = match.index + match[0].indexOf(value);
    matches.push({
      start: valueStart,
      end: valueStart + value.length,
      value,
      tokens: extractClassTokensFromExpression(value),
    });
    match = pattern.exec(content);
  }

  return matches.sort((left, right) => left.start - right.start);
}

function findClassOccurrences(content, className) {
  const pattern = new RegExp(
    `(?<![A-Za-z0-9_-])${className}(?![A-Za-z0-9_-])`,
    "g",
  );
  const occurrences = [];
  let match = pattern.exec(content);

  while (match) {
    occurrences.push({
      start: match.index,
      end: match.index + className.length,
    });
    match = pattern.exec(content);
  }

  return occurrences;
}

function classifySourceUsage(filePath, className) {
  const content = fs.readFileSync(filePath, "utf8");
  const attributeMatches = findStaticClassAttributeMatches(content);
  const dynamicExpressionMatches = findDynamicClassExpressionMatches(content);
  const namedClassValueMatches = findNamedClassValueMatches(content);
  const dynamicClassVariableMatches = findDynamicClassVariableMatches(
    content,
    dynamicExpressionMatches,
  );
  const staticReplacements = [];
  let staticOccurrenceCount = 0;

  for (const attributeMatch of attributeMatches) {
    const tokens = attributeMatch.value
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean);
    const matchCount = tokens.filter((token) => token === className).length;

    if (matchCount > 0) {
      staticOccurrenceCount += matchCount;
      staticReplacements.push(attributeMatch);
    }
  }

  let dynamicOccurrenceCount = 0;

  for (const expressionMatch of dynamicExpressionMatches) {
    dynamicOccurrenceCount += expressionMatch.tokens.filter(
      (token) => token === className,
    ).length;
  }

  for (const namedMatch of namedClassValueMatches) {
    dynamicOccurrenceCount += namedMatch.tokens.filter(
      (token) => token === className,
    ).length;
  }

  for (const variableMatch of dynamicClassVariableMatches) {
    dynamicOccurrenceCount += variableMatch.tokens.filter(
      (token) => token === className,
    ).length;
  }

  const occurrences = findClassOccurrences(content, className);
  const unmatchedOccurrences = occurrences.filter((occurrence) => {
    const inStaticAttribute = attributeMatches.some(
      (attribute) =>
        occurrence.start >= attribute.start && occurrence.end <= attribute.end,
    );

    if (inStaticAttribute) {
      return false;
    }

    const inDynamicExpression = dynamicExpressionMatches.some(
      (expression) =>
        occurrence.start >= expression.start &&
        occurrence.end <= expression.end,
    );

    if (inDynamicExpression) {
      return false;
    }

    const inNamedClassValue = namedClassValueMatches.some(
      (namedMatch) =>
        occurrence.start >= namedMatch.start &&
        occurrence.end <= namedMatch.end,
    );

    if (inNamedClassValue) {
      return false;
    }

    const inDynamicClassVariable = dynamicClassVariableMatches.some(
      (variableMatch) =>
        occurrence.start >= variableMatch.start &&
        occurrence.end <= variableMatch.end,
    );

    return !inDynamicClassVariable;
  });

  if (
    staticOccurrenceCount === 0 &&
    dynamicOccurrenceCount === 0 &&
    unmatchedOccurrences.length === 0
  ) {
    return {
      safe: true,
      replacements: [],
      occurrenceCount: 0,
      staticOccurrenceCount: 0,
      dynamicOccurrenceCount: 0,
      unknownOccurrenceCount: 0,
    };
  }

  return {
    safe: dynamicOccurrenceCount === 0 && unmatchedOccurrences.length === 0,
    reason:
      unmatchedOccurrences.length > 0
        ? "class used outside recognized class/className patterns"
        : dynamicOccurrenceCount > 0
          ? "class used in dynamic className composition"
          : null,
    replacements: staticReplacements,
    occurrenceCount:
      staticOccurrenceCount +
      dynamicOccurrenceCount +
      unmatchedOccurrences.length,
    staticOccurrenceCount,
    dynamicOccurrenceCount,
    unknownOccurrenceCount: unmatchedOccurrences.length,
  };
}

function summarizeClassUsage(className, sourceFiles, allCssFiles) {
  const sourceUsageByFile = new Map();
  let staticReferenceCount = 0;
  let dynamicReferenceCount = 0;
  let unknownSourceReferenceCount = 0;
  let hasUnsafeSourceUsage = false;
  let unsafeReason = null;

  for (const sourceFile of sourceFiles) {
    const usage = classifySourceUsage(sourceFile, className);

    if (!usage.safe) {
      hasUnsafeSourceUsage = true;
      unsafeReason = unsafeReason ?? usage.reason;
    }

    staticReferenceCount += usage.staticOccurrenceCount ?? 0;
    dynamicReferenceCount += usage.dynamicOccurrenceCount ?? 0;
    unknownSourceReferenceCount += usage.unknownOccurrenceCount ?? 0;

    if (usage.replacements.length > 0) {
      sourceUsageByFile.set(sourceFile, usage.replacements);
    }
  }

  const conventionCategory =
    dynamicReferenceCount > 0 && isStateClassName(className)
      ? "state"
      : dynamicReferenceCount > 0
        ? "dynamic"
        : null;

  return {
    cssReferenceCount: countCssSelectorReferences(allCssFiles, className),
    staticReferenceCount,
    dynamicReferenceCount,
    unknownSourceReferenceCount,
    conventionCategory,
    isIgnoredClassName: isIgnoredClassName(className),
    hasUnsafeSourceUsage,
    unsafeReason,
    sourceUsageByFile,
  };
}

function createCssAuditContext(options = {}) {
  const repoRoot = options.repoRoot ?? process.cwd();
  const clientSourceRoot =
    options.clientSourceRoot ??
    path.join(repoRoot, "apps/loremaster/client/src");
  const defaultLayoutsPath = path.join(clientSourceRoot, "styles/layouts.css");
  const targetDirectory = path.resolve(
    repoRoot,
    options.targetDirectory ?? "apps/loremaster/client/src",
  );
  const layoutsPath = path.resolve(
    repoRoot,
    options.layoutsPath ?? defaultLayoutsPath,
  );

  if (!fs.existsSync(targetDirectory)) {
    throw new Error(`Target directory not found: ${targetDirectory}`);
  }

  if (!fs.existsSync(clientSourceRoot)) {
    throw new Error(`Client source root not found: ${clientSourceRoot}`);
  }

  return {
    repoRoot,
    clientSourceRoot,
    targetDirectory,
    layoutsPath,
    targetCssFiles: collectFiles(
      targetDirectory,
      (extension) => extension === CSS_EXTENSION,
    ),
    allCssFiles: collectFiles(
      clientSourceRoot,
      (extension) => extension === CSS_EXTENSION,
    ),
    sourceFiles: collectFiles(clientSourceRoot, (extension) =>
      SOURCE_EXTENSIONS.has(extension),
    ),
    targetSourceFiles: collectFiles(targetDirectory, (extension) =>
      SOURCE_EXTENSIONS.has(extension),
    ),
  };
}

function collectDefinedClasses(cssFiles, repoRoot = process.cwd()) {
  const classes = new Map();

  for (const filePath of cssFiles) {
    const cssText = fs.readFileSync(filePath, "utf8");
    const rules = parseCssRules(cssText);

    for (const rule of rules) {
      for (const selector of rule.selectors) {
        const classNames = extractClassNamesFromSelector(selector);

        if (classNames.length === 0) {
          continue;
        }

        for (const className of classNames) {
          const entry = classes.get(className) ?? {
            className,
            definitions: [],
          };

          entry.definitions.push({
            filePath: path.relative(repoRoot, filePath),
            selector,
            context: formatContext(rule.context),
          });
          classes.set(className, entry);
        }
      }
    }
  }

  return classes;
}

function tokenizeClassValue(value) {
  return value
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => /^[A-Za-z0-9_-]+$/.test(token));
}

function addReference(referenceMap, className, reference) {
  const entry = referenceMap.get(className) ?? {
    className,
    staticReferenceCount: 0,
    dynamicReferenceCount: 0,
    references: [],
  };

  if (reference.kind === "static") {
    entry.staticReferenceCount += 1;
  } else {
    entry.dynamicReferenceCount += 1;
  }

  entry.references.push(reference);
  referenceMap.set(className, entry);
}

function collectReferencedClasses(sourceFiles, repoRoot = process.cwd()) {
  const references = new Map();

  for (const filePath of sourceFiles) {
    const content = fs.readFileSync(filePath, "utf8");
    const relativePath = path.relative(repoRoot, filePath);
    const staticMatches = findStaticClassAttributeMatches(content);
    const dynamicMatches = findDynamicClassExpressionMatches(content);
    const namedMatches = findNamedClassValueMatches(content);
    const dynamicVariableMatches = findDynamicClassVariableMatches(
      content,
      dynamicMatches,
    );

    for (const match of staticMatches) {
      for (const className of tokenizeClassValue(match.value)) {
        addReference(references, className, {
          filePath: relativePath,
          kind: "static",
        });
      }
    }

    for (const match of [
      ...dynamicMatches,
      ...namedMatches,
      ...dynamicVariableMatches,
    ]) {
      for (const className of tokenizeClassValue(match.tokens.join(" "))) {
        addReference(references, className, {
          filePath: relativePath,
          kind: "dynamic",
        });
      }
    }
  }

  return references;
}

module.exports = {
  collectDefinedClasses,
  collectReferencedClasses,
  classifySourceUsage,
  createCssAuditContext,
  declarationsToObject,
  extractClassNamesFromSelector,
  findClassOccurrences,
  findDynamicClassExpressionMatches,
  findDynamicClassVariableMatches,
  findNamedClassValueMatches,
  findStaticClassAttributeMatches,
  formatContext,
  isSimpleClassSelector,
  parseCssRules,
  selectorToClassName,
  summarizeClassUsage,
};
