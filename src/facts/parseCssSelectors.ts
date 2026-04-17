import type { CssSelectorBranchFact } from "./types.js";

type SelectorSegment = {
  classNames: string[];
  negativeClassNames: string[];
  hasUnknownSemantics: boolean;
  hasSubjectModifiers: boolean;
  hasTypeOrIdConstraint: boolean;
};

export function extractSelectorBranchFacts(selectorText: string): CssSelectorBranchFact[] {
  const branches = splitTopLevelSelectorList(selectorText);
  const branchFacts: CssSelectorBranchFact[] = [];

  for (const branch of branches) {
    const branchFact = parseSelectorBranch(branch);
    if (!branchFact) {
      continue;
    }

    branchFacts.push(branchFact);
  }

  return branchFacts;
}

function parseSelectorBranch(branch: string): CssSelectorBranchFact | undefined {
  const normalizedBranch = branch.trim();
  if (!normalizedBranch) {
    return undefined;
  }

  const segments = splitSelectorBranchIntoSegments(normalizedBranch);
  if (segments.length === 0) {
    return undefined;
  }

  const parsedSegments = segments.map((segment) => parseSelectorSegment(segment));
  const subjectSegment = parsedSegments.at(-1);
  if (!subjectSegment) {
    return undefined;
  }

  const subjectClassNames = unique(subjectSegment.classNames);
  if (subjectClassNames.length === 0) {
    return undefined;
  }

  const contextClassNames = unique(
    parsedSegments.slice(0, -1).flatMap((segment) => segment.classNames),
  );
  const negativeClassNames = unique(subjectSegment.negativeClassNames);
  const hasUnknownSemantics = parsedSegments.some((segment) => segment.hasUnknownSemantics);
  const hasCombinators = segments.length > 1;
  const hasSubjectModifiers =
    subjectSegment.hasSubjectModifiers || subjectSegment.hasTypeOrIdConstraint;

  let matchKind: CssSelectorBranchFact["matchKind"];
  if (hasUnknownSemantics || subjectSegment.hasTypeOrIdConstraint) {
    matchKind = "complex";
  } else if (hasCombinators) {
    matchKind = "contextual";
  } else if (subjectClassNames.length > 1) {
    matchKind = "compound";
  } else {
    matchKind = "standalone";
  }

  return {
    raw: normalizedBranch,
    matchKind,
    subjectClassNames,
    requiredClassNames: subjectClassNames,
    contextClassNames,
    negativeClassNames,
    hasCombinators,
    hasSubjectModifiers,
    hasUnknownSemantics,
  };
}

function splitTopLevelSelectorList(value: string): string[] {
  const selectors: string[] = [];
  let start = 0;
  let bracketDepth = 0;
  let parenDepth = 0;
  let stringQuote: string | undefined;
  let escaped = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (stringQuote) {
      if (character === "\\") {
        escaped = true;
      } else if (character === stringQuote) {
        stringQuote = undefined;
      }
      continue;
    }

    if (character === '"' || character === "'") {
      stringQuote = character;
      continue;
    }

    if (character === "[") {
      bracketDepth += 1;
      continue;
    }

    if (character === "]") {
      bracketDepth = Math.max(0, bracketDepth - 1);
      continue;
    }

    if (character === "(") {
      parenDepth += 1;
      continue;
    }

    if (character === ")") {
      parenDepth = Math.max(0, parenDepth - 1);
      continue;
    }

    if (character === "," && bracketDepth === 0 && parenDepth === 0) {
      selectors.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }

  selectors.push(value.slice(start).trim());
  return selectors.filter((selector) => selector.length > 0);
}

function splitSelectorBranchIntoSegments(branch: string): string[] {
  const segments: string[] = [];
  let current = "";
  let bracketDepth = 0;
  let parenDepth = 0;
  let stringQuote: string | undefined;
  let escaped = false;

  for (let index = 0; index < branch.length; index += 1) {
    const character = branch[index];

    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }

    if (character === "\\") {
      current += character;
      escaped = true;
      continue;
    }

    if (stringQuote) {
      current += character;
      if (character === stringQuote) {
        stringQuote = undefined;
      }
      continue;
    }

    if (character === '"' || character === "'") {
      current += character;
      stringQuote = character;
      continue;
    }

    if (character === "[") {
      current += character;
      bracketDepth += 1;
      continue;
    }

    if (character === "]") {
      current += character;
      bracketDepth = Math.max(0, bracketDepth - 1);
      continue;
    }

    if (character === "(") {
      current += character;
      parenDepth += 1;
      continue;
    }

    if (character === ")") {
      current += character;
      parenDepth = Math.max(0, parenDepth - 1);
      continue;
    }

    if (bracketDepth === 0 && parenDepth === 0) {
      if (character === ">" || character === "+" || character === "~") {
        pushIfPresent(segments, current);
        current = "";
        continue;
      }

      if (/\s/.test(character)) {
        pushIfPresent(segments, current);
        current = "";
        continue;
      }
    }

    current += character;
  }

  pushIfPresent(segments, current);
  return segments;
}

function parseSelectorSegment(segment: string): SelectorSegment {
  const classNames: string[] = [];
  const negativeClassNames: string[] = [];
  let hasUnknownSemantics = false;
  let hasSubjectModifiers = false;
  let hasTypeOrIdConstraint = false;
  let index = 0;

  while (index < segment.length) {
    const character = segment[index];

    if (character === ".") {
      const identifier = readCssIdentifier(segment, index + 1);
      if (!identifier) {
        hasUnknownSemantics = true;
        index += 1;
        continue;
      }

      classNames.push(identifier.value);
      index = identifier.nextIndex;
      continue;
    }

    if (character === "#") {
      const identifier = readCssIdentifier(segment, index + 1);
      hasSubjectModifiers = true;
      hasTypeOrIdConstraint = true;
      index = identifier?.nextIndex ?? index + 1;
      continue;
    }

    if (character === "[") {
      hasSubjectModifiers = true;
      index = skipBalancedSection(segment, index, "[", "]");
      continue;
    }

    if (character === ":") {
      const isPseudoElement = segment[index + 1] === ":";
      hasSubjectModifiers = true;
      index += isPseudoElement ? 2 : 1;

      const pseudoName = readCssIdentifier(segment, index);
      if (!pseudoName) {
        hasUnknownSemantics = true;
        continue;
      }

      index = pseudoName.nextIndex;
      if (segment[index] !== "(") {
        continue;
      }

      const inner = readParenthesizedContent(segment, index);
      index = inner.nextIndex;

      if (pseudoName.value.toLowerCase() === "not") {
        const parsedNegativeClasses = parseNegatedClassNames(inner.content);
        if (parsedNegativeClasses) {
          negativeClassNames.push(...parsedNegativeClasses);
          continue;
        }
      }

      hasUnknownSemantics = true;
      continue;
    }

    if (character === "*" || isIdentifierStart(character) || character === "|") {
      hasSubjectModifiers = true;
      hasTypeOrIdConstraint = true;
      index = skipTypeOrNamespaceToken(segment, index);
      continue;
    }

    if (character === "&") {
      hasUnknownSemantics = true;
      index += 1;
      continue;
    }

    index += 1;
  }

  return {
    classNames,
    negativeClassNames,
    hasUnknownSemantics,
    hasSubjectModifiers,
    hasTypeOrIdConstraint,
  };
}

function parseNegatedClassNames(value: string): string[] | undefined {
  const selectors = splitTopLevelSelectorList(value);
  if (selectors.length === 0) {
    return undefined;
  }

  const classNames: string[] = [];
  for (const selector of selectors) {
    const trimmed = selector.trim();
    if (!trimmed.startsWith(".")) {
      return undefined;
    }

    const identifier = readCssIdentifier(trimmed, 1);
    if (!identifier || identifier.nextIndex !== trimmed.length) {
      return undefined;
    }

    classNames.push(identifier.value);
  }

  return classNames;
}

function readParenthesizedContent(
  value: string,
  openParenIndex: number,
): { content: string; nextIndex: number } {
  let index = openParenIndex + 1;
  let depth = 1;
  let stringQuote: string | undefined;
  let escaped = false;

  while (index < value.length) {
    const character = value[index];

    if (escaped) {
      escaped = false;
      index += 1;
      continue;
    }

    if (stringQuote) {
      if (character === "\\") {
        escaped = true;
      } else if (character === stringQuote) {
        stringQuote = undefined;
      }
      index += 1;
      continue;
    }

    if (character === '"' || character === "'") {
      stringQuote = character;
      index += 1;
      continue;
    }

    if (character === "(") {
      depth += 1;
      index += 1;
      continue;
    }

    if (character === ")") {
      depth -= 1;
      if (depth === 0) {
        return {
          content: value.slice(openParenIndex + 1, index),
          nextIndex: index + 1,
        };
      }
      index += 1;
      continue;
    }

    index += 1;
  }

  return {
    content: value.slice(openParenIndex + 1),
    nextIndex: value.length,
  };
}

function skipBalancedSection(
  value: string,
  startIndex: number,
  openCharacter: "[" | "(",
  closeCharacter: "]" | ")",
): number {
  let index = startIndex + 1;
  let depth = 1;
  let stringQuote: string | undefined;
  let escaped = false;

  while (index < value.length) {
    const character = value[index];

    if (escaped) {
      escaped = false;
      index += 1;
      continue;
    }

    if (stringQuote) {
      if (character === "\\") {
        escaped = true;
      } else if (character === stringQuote) {
        stringQuote = undefined;
      }
      index += 1;
      continue;
    }

    if (character === '"' || character === "'") {
      stringQuote = character;
      index += 1;
      continue;
    }

    if (character === openCharacter) {
      depth += 1;
      index += 1;
      continue;
    }

    if (character === closeCharacter) {
      depth -= 1;
      index += 1;
      if (depth === 0) {
        return index;
      }
      continue;
    }

    index += 1;
  }

  return value.length;
}

function skipTypeOrNamespaceToken(value: string, startIndex: number): number {
  let index = startIndex;
  while (index < value.length) {
    const character = value[index];
    if (character === "|" || isIdentifierCharacter(character) || character === "\\") {
      if (character === "\\") {
        index = skipEscape(value, index);
        continue;
      }

      index += 1;
      continue;
    }

    break;
  }

  return index === startIndex ? startIndex + 1 : index;
}

function readCssIdentifier(
  value: string,
  startIndex: number,
): { value: string; nextIndex: number } | undefined {
  let index = startIndex;
  let identifier = "";

  while (index < value.length) {
    const character = value[index];
    if (character === "\\") {
      const escapedValue = readEscape(value, index);
      identifier += escapedValue.value;
      index = escapedValue.nextIndex;
      continue;
    }

    if (!isIdentifierCharacter(character)) {
      break;
    }

    identifier += character;
    index += 1;
  }

  if (!identifier) {
    return undefined;
  }

  return {
    value: identifier,
    nextIndex: index,
  };
}

function readEscape(value: string, startIndex: number): { value: string; nextIndex: number } {
  const nextCharacter = value[startIndex + 1];
  if (!nextCharacter) {
    return { value: "", nextIndex: startIndex + 1 };
  }

  if (isHexCharacter(nextCharacter)) {
    let index = startIndex + 1;
    let hexValue = "";
    while (index < value.length && hexValue.length < 6 && isHexCharacter(value[index])) {
      hexValue += value[index];
      index += 1;
    }

    if (/\s/.test(value[index] ?? "")) {
      index += 1;
    }

    const codePoint = Number.parseInt(hexValue, 16);
    return {
      value: Number.isNaN(codePoint) ? "" : String.fromCodePoint(codePoint),
      nextIndex: index,
    };
  }

  return {
    value: nextCharacter,
    nextIndex: startIndex + 2,
  };
}

function skipEscape(value: string, startIndex: number): number {
  return readEscape(value, startIndex).nextIndex;
}

function pushIfPresent(values: string[], current: string) {
  const trimmed = current.trim();
  if (trimmed.length > 0) {
    values.push(trimmed);
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function isIdentifierStart(character: string): boolean {
  return /[_a-zA-Z-]/.test(character);
}

function isIdentifierCharacter(character: string): boolean {
  return /[_a-zA-Z0-9-]/.test(character);
}

function isHexCharacter(character: string): boolean {
  return /[0-9a-fA-F]/.test(character);
}
