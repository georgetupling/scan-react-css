import type { ClassReferenceFact, CssClassDefinitionFact } from "../../facts/types.js";
import type { RuleDefinition } from "../types.js";
import { isCssModuleFile, isCssModuleReference } from "../helpers.js";
import { getDefinitionReachabilityStatus } from "../reachability.js";

type CompoundReferenceGroup = {
  classNames: Set<string>;
};

export const unusedCompoundSelectorBranchRule: RuleDefinition = {
  ruleId: "unused-compound-selector-branch",
  family: "optimization-and-migration",
  defaultSeverity: "info",
  run(context) {
    const severity = context.getRuleSeverity("unused-compound-selector-branch", "info");
    if (severity === "off") {
      return [];
    }

    const findings = [];
    const groupedReferencesBySourceFile = new Map(
      context.model.graph.sourceFiles.map((sourceFile) => [
        sourceFile.path,
        groupClassReferencesByExpression(sourceFile.classReferences),
      ]),
    );

    for (const cssFile of context.model.graph.cssFiles) {
      if (isCssModuleFile(context.model, cssFile.path)) {
        continue;
      }

      for (const definition of cssFile.classDefinitions) {
        if (!isEligibleCompoundDefinition(definition)) {
          continue;
        }

        let hasConvincingUsage = false;
        let hasPossibleUsage = false;

        for (const sourceFile of context.model.graph.sourceFiles) {
          const groupedReferences = groupedReferencesBySourceFile.get(sourceFile.path) ?? [];
          if (groupedReferences.length === 0) {
            continue;
          }

          const hasMatchingGroup = groupedReferences.some((group) =>
            definition.selectorBranch.requiredClassNames.every((className) =>
              group.classNames.has(className),
            ),
          );
          if (!hasMatchingGroup) {
            continue;
          }

          const status = getDefinitionReachabilityStatus(
            context.model,
            sourceFile.path,
            cssFile.path,
          );
          if (
            status === "direct" ||
            status === "import-context" ||
            status === "render-context-definite"
          ) {
            hasConvincingUsage = true;
            break;
          }

          if (status === "render-context-possible") {
            hasPossibleUsage = true;
          }
        }

        if (hasConvincingUsage || hasPossibleUsage) {
          continue;
        }

        findings.push(
          context.createFinding({
            ruleId: "unused-compound-selector-branch",
            family: "optimization-and-migration",
            severity,
            confidence: "high",
            message: `Compound selector branch "${definition.selector}" does not have any convincing reachable React usage where all required classes appear together.`,
            primaryLocation: {
              filePath: cssFile.path,
              line: definition.line,
            },
            subject: {
              className: definition.className,
              cssFilePath: cssFile.path,
            },
            metadata: {
              selector: definition.selector,
              requiredClassNames: definition.selectorBranch.requiredClassNames,
              atRuleContext: definition.atRuleContext,
            },
          }),
        );
      }
    }

    return findings;
  },
};

function isEligibleCompoundDefinition(definition: CssClassDefinitionFact): boolean {
  return (
    definition.selectorBranch.matchKind === "compound" &&
    !definition.selectorBranch.hasUnknownSemantics &&
    definition.selectorBranch.requiredClassNames.length > 1
  );
}

function groupClassReferencesByExpression(
  references: ClassReferenceFact[],
): CompoundReferenceGroup[] {
  const groups = new Map<string, CompoundReferenceGroup>();

  for (const reference of references) {
    if (!reference.className || isCssModuleReference(reference.kind)) {
      continue;
    }

    const key = `${reference.line}:${reference.column}:${reference.kind}:${reference.source}`;
    const group = groups.get(key) ?? { classNames: new Set<string>() };
    group.classNames.add(reference.className);
    groups.set(key, group);
  }

  return [...groups.values()];
}
