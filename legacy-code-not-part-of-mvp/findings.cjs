const path = require("node:path");

const RULES = {
  ignored: {
    severity: "info",
    precedence: 100,
    suppresses: ["*"],
    label: "Ignored",
  },
  "missing-css-class": {
    severity: "error",
    precedence: 90,
    suppresses: [
      "unused-css-class",
      "manual-review",
      "page-style-used-by-single-component",
      "component-style-cross-component",
      "shared-style-not-shared",
      "layout-replacement-advisory",
    ],
    label: "Missing CSS class",
  },
  "unused-css-class": {
    severity: "error",
    precedence: 80,
    suppresses: [
      "manual-review",
      "page-style-used-by-single-component",
      "component-style-cross-component",
      "shared-style-not-shared",
      "layout-replacement-advisory",
    ],
    label: "Unused CSS class",
  },
  "manual-review": {
    severity: "warning",
    precedence: 70,
    suppresses: [
      "page-style-used-by-single-component",
      "component-style-cross-component",
      "feature-shared-not-shared",
      "shared-style-not-shared",
      "layout-replacement-advisory",
    ],
    label: "Manual review",
  },
  "page-style-used-by-single-component": {
    severity: "warning",
    precedence: 60,
    suppresses: [],
    label: "Page style used by single component",
  },
  "component-style-cross-component": {
    severity: "warning",
    precedence: 50,
    suppresses: [],
    label: "Component style used across components",
  },
  "shared-style-not-shared": {
    severity: "info",
    precedence: 30,
    suppresses: [],
    label: "Shared style not shared",
  },
  "layout-replacement-advisory": {
    severity: "info",
    precedence: 20,
    suppresses: [],
    label: "Layout utility replacement available",
  },
};

function getRule(ruleId) {
  const rule = RULES[ruleId];

  if (!rule) {
    throw new Error(`Unknown css audit rule: ${ruleId}`);
  }

  return rule;
}

function createFinding({
  className,
  ruleId,
  message,
  contexts = [],
  source = {},
  metadata = {},
}) {
  const rule = getRule(ruleId);

  return {
    className,
    ruleId,
    severity: rule.severity,
    precedence: rule.precedence,
    suppresses: rule.suppresses,
    label: rule.label,
    message,
    contexts,
    source,
    metadata,
  };
}

function normalizeUnusedResults(results) {
  return results.flatMap((result) => {
    if (result.category === "ignored") {
      return [];
    }

    if (result.category === "unused") {
      return [
        createFinding({
          className: result.className,
          ruleId: "unused-css-class",
          message: result.reason ?? "no static source references found",
          contexts: result.definitions.map((definition) => ({
            filePath: definition.filePath,
            context: definition.context,
          })),
          metadata: {
            sourceKind: "unused",
            definitionCount: result.definitionCount,
          },
        }),
      ];
    }

    if (result.category === "manual") {
      return [
        createFinding({
          className: result.className,
          ruleId: "manual-review",
          message: result.reason ?? "unused-css audit requires manual review",
          contexts: result.definitions.map((definition) => ({
            filePath: definition.filePath,
            context: definition.context,
          })),
          metadata: {
            sourceKind: "unused",
          },
        }),
      ];
    }

    return [];
  });
}

function normalizeMissingResults(results) {
  return results.flatMap((result) => {
    if (result.category === "ignored") {
      return [];
    }

    if (result.category === "missing") {
      return [
        createFinding({
          className: result.className,
          ruleId: "missing-css-class",
          message: result.reason ?? "no matching CSS class definition found",
          contexts: result.references.map((reference) => ({
            filePath: reference.filePath,
            context: reference.kind,
          })),
          metadata: {
            sourceKind: "missing",
          },
        }),
      ];
    }

    if (
      result.category === "dynamic-missing" ||
      result.category === "dynamic-convention-missing"
    ) {
      return [
        createFinding({
          className: result.className,
          ruleId: "manual-review",
          message:
            result.reason ?? "dynamic class reference requires manual review",
          contexts: result.references.map((reference) => ({
            filePath: reference.filePath,
            context: reference.kind,
          })),
          metadata: {
            sourceKind: "missing",
          },
        }),
      ];
    }

    return [];
  });
}

function normalizeOwnershipResults(results) {
  return results.flatMap((result) => {
    if (result.category === "ignored") {
      return [];
    }

    if (result.category === "page-style-used-by-single-component") {
      return [
        createFinding({
          className: result.className,
          ruleId: "page-style-used-by-single-component",
          message: result.reason,
          contexts: result.definitions.map((definition) => ({
            filePath: definition.filePath,
            context: definition.context,
          })),
          metadata: {
            sourceKind: "ownership",
            referenceFiles: result.referenceFiles,
          },
        }),
      ];
    }

    if (result.category === "component-style-cross-component") {
      return [
        createFinding({
          className: result.className,
          ruleId: "component-style-cross-component",
          message: result.reason,
          contexts: result.definitions.map((definition) => ({
            filePath: definition.filePath,
            context: definition.context,
          })),
          metadata: {
            sourceKind: "ownership",
            referenceFiles: result.referenceFiles,
          },
        }),
      ];
    }

    if (result.category === "shared-style-not-shared") {
      return [
        createFinding({
          className: result.className,
          ruleId: "shared-style-not-shared",
          message: result.reason,
          contexts: result.definitions.map((definition) => ({
            filePath: definition.filePath,
            context: definition.context,
          })),
          metadata: {
            sourceKind: "ownership",
            referenceFiles: result.referenceFiles,
          },
        }),
      ];
    }

    if (result.category === "manual") {
      return [
        createFinding({
          className: result.className,
          ruleId: "manual-review",
          message: result.reason ?? "ownership audit requires manual review",
          contexts: result.definitions.map((definition) => ({
            filePath: definition.filePath,
            context: definition.context,
          })),
          metadata: {
            sourceKind: "ownership",
          },
        }),
      ];
    }

    return [];
  });
}

function normalizeLayoutResults(suggestions, repoRoot) {
  return suggestions
    .filter((suggestion) => suggestion.category === "manual")
    .map((suggestion) =>
      createFinding({
        className: suggestion.className,
        ruleId: "layout-replacement-advisory",
        message:
          suggestion.reason ??
          `can be replaced with ${suggestion.classes.join(" ")}`,
        contexts: [
          {
            filePath: path.relative(repoRoot, suggestion.filePath),
            context: suggestion.context,
          },
        ],
        metadata: {
          sourceKind: "layout",
          replacementClasses: suggestion.classes,
        },
      }),
    );
}

function aggregateFindings(findings) {
  const findingsByClass = new Map();

  for (const finding of findings) {
    const entry = findingsByClass.get(finding.className) ?? [];
    entry.push(finding);
    findingsByClass.set(finding.className, entry);
  }

  return [...findingsByClass.entries()]
    .map(([className, classFindings]) => {
      const sorted = [...classFindings].sort((left, right) => {
        if (left.precedence !== right.precedence) {
          return right.precedence - left.precedence;
        }

        return left.ruleId.localeCompare(right.ruleId);
      });

      const visible = [];
      const suppressedRuleIds = new Set();
      let suppressAll = false;

      for (const finding of sorted) {
        if (suppressAll || suppressedRuleIds.has(finding.ruleId)) {
          continue;
        }

        visible.push(finding);

        if (finding.suppresses.includes("*")) {
          suppressAll = true;
          continue;
        }

        for (const suppressedRuleId of finding.suppresses) {
          suppressedRuleIds.add(suppressedRuleId);
        }
      }

      return {
        className,
        primary: visible[0] ?? null,
        secondary: visible.slice(1),
        all: sorted,
      };
    })
    .filter((entry) => entry.primary)
    .sort((left, right) => {
      if (left.primary.precedence !== right.primary.precedence) {
        return right.primary.precedence - left.primary.precedence;
      }

      return left.className.localeCompare(right.className);
    });
}

function collectAuditFindings({
  layoutAudit,
  missingAudit,
  ownershipAudit,
  unusedAudit,
}) {
  return [
    ...normalizeUnusedResults(unusedAudit.results),
    ...normalizeMissingResults(missingAudit.results),
    ...normalizeOwnershipResults(ownershipAudit.results),
    ...normalizeLayoutResults(
      layoutAudit.suggestions,
      layoutAudit.context.repoRoot,
    ),
  ];
}

module.exports = {
  RULES,
  aggregateFindings,
  collectAuditFindings,
};
