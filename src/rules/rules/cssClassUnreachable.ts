import type { AnalysisTrace } from "../../static-analysis-engine/index.js";
import type { RuleContext, RuleDefinition, UnresolvedFinding } from "../types.js";

export const cssClassUnreachableRule: RuleDefinition = {
  id: "css-class-unreachable",
  run(context) {
    return runCssClassUnreachableRule(context);
  },
};

function runCssClassUnreachableRule(context: RuleContext): UnresolvedFinding[] {
  const findings: UnresolvedFinding[] = [];
  const definitionsById = new Map(
    context.analysis.entities.classDefinitions.map((definition) => [definition.id, definition]),
  );
  const stylesheetsById = new Map(
    context.analysis.entities.stylesheets.map((stylesheet) => [stylesheet.id, stylesheet]),
  );
  const providerSatisfactionsByReferenceAndClass = new Set(
    context.analysis.relations.providerClassSatisfactions.map(
      (satisfaction) => `${satisfaction.referenceId}:${satisfaction.className}`,
    ),
  );
  const matchesByReferenceAndDefinition = new Map(
    context.analysis.relations.referenceMatches.map((match) => [
      `${match.referenceId}:${match.definitionId}`,
      match,
    ]),
  );

  for (const reference of context.analysis.entities.classReferences) {
    for (const className of reference.definiteClassNames) {
      if (providerSatisfactionsByReferenceAndClass.has(`${reference.id}:${className}`)) {
        continue;
      }

      const definitionIds = context.analysis.indexes.definitionsByClassName.get(className) ?? [];
      if (definitionIds.length === 0) {
        continue;
      }

      const matches = definitionIds
        .map((definitionId) =>
          matchesByReferenceAndDefinition.get(`${reference.id}:${definitionId}`),
        )
        .filter((match): match is NonNullable<typeof match> => Boolean(match));
      if (matches.length === 0 || matches.some((match) => match.reachability !== "unavailable")) {
        continue;
      }

      const definitions = definitionIds
        .map((definitionId) => definitionsById.get(definitionId))
        .filter((definition): definition is NonNullable<typeof definition> => Boolean(definition));
      const stylesheetIds = [
        ...new Set(definitions.map((definition) => definition.stylesheetId)),
      ].sort((left, right) => left.localeCompare(right));

      findings.push({
        id: `css-class-unreachable:${reference.id}:${className}`,
        ruleId: "css-class-unreachable",
        confidence: "high",
        message: `Class "${className}" is defined, but every matching stylesheet is unreachable from this reference.`,
        subject: {
          kind: "class-reference",
          id: reference.id,
        },
        location: reference.location,
        evidence: [
          {
            kind: "source-file",
            id: reference.sourceFileId,
          },
          ...stylesheetIds.map((stylesheetId) => ({
            kind: "stylesheet" as const,
            id: stylesheetId,
          })),
        ],
        traces: buildUnreachableClassTraces({
          reference,
          className,
          matches,
          stylesheetFilePaths: stylesheetIds
            .map((stylesheetId) => stylesheetsById.get(stylesheetId)?.filePath)
            .filter((filePath): filePath is string => Boolean(filePath)),
        }),
        data: {
          className,
          rawExpressionText: reference.rawExpressionText,
          expressionKind: reference.expressionKind,
          definitionIds,
          stylesheetIds,
        },
      });
    }
  }

  return findings.sort((left, right) => left.id.localeCompare(right.id));
}

function buildUnreachableClassTraces(input: {
  reference: RuleContext["analysis"]["entities"]["classReferences"][number];
  className: string;
  matches: RuleContext["analysis"]["relations"]["referenceMatches"];
  stylesheetFilePaths: string[];
}): AnalysisTrace[] {
  return [
    {
      traceId: `rule-evaluation:css-class-unreachable:${input.reference.id}:${input.className}`,
      category: "rule-evaluation",
      summary: `class "${input.className}" was found, but every matching definition is in an unreachable stylesheet`,
      anchor: input.reference.location,
      children: [
        ...input.reference.traces,
        ...input.matches.flatMap((match) => match.traces),
        {
          traceId: `rule-evaluation:css-class-unreachable:${input.reference.id}:${input.className}:reachability-check`,
          category: "rule-evaluation",
          summary: `all matching class definitions for "${input.className}" had unavailable stylesheet reachability`,
          anchor: input.reference.location,
          children: [],
          metadata: {
            className: input.className,
            stylesheetFilePaths: input.stylesheetFilePaths,
          },
        },
      ],
      metadata: {
        ruleId: "css-class-unreachable",
        className: input.className,
        referenceId: input.reference.id,
        sourceFileId: input.reference.sourceFileId,
        rawExpressionText: input.reference.rawExpressionText,
      },
    },
  ];
}
