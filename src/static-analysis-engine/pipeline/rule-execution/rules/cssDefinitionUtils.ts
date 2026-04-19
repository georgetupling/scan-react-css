import type {
  CssAtRuleContextFact,
  CssClassDefinitionFact,
  CssDeclarationFact,
} from "../../../facts/types.js";

export function getDeclarationSignature(declarations: CssDeclarationFact[]): string {
  return declarations
    .map((declaration) => `${declaration.property}:${declaration.value}`)
    .sort((left, right) => left.localeCompare(right))
    .join("|");
}

export function getAtRuleContextSignature(atRuleContext: CssAtRuleContextFact[]): string {
  return atRuleContext.map((entry) => `${entry.name}:${entry.params}`).join("|");
}

export function isPlainClassDefinition(definition: CssClassDefinitionFact): boolean {
  return (
    definition.selectorBranch.matchKind === "standalone" &&
    !definition.selectorBranch.hasUnknownSemantics
  );
}

export function isSimpleRootClassDefinition(definition: CssClassDefinitionFact): boolean {
  return isPlainClassDefinition(definition) && !definition.selectorBranch.hasSubjectModifiers;
}
