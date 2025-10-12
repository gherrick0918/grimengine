import type { Actor, ActorTag, EncounterState } from './encounter.js';
import { hasCondition } from './conditions.js';

export type AttackMode = 'melee' | 'ranged';
export type AdvantageState = 'normal' | 'advantage' | 'disadvantage';

type RelevantCondition = 'prone' | 'restrained' | 'invisible';

function normalizeIdentifier(value: string | undefined): string | undefined {
  return value ? value.toLowerCase().replace(/[^a-z0-9]+/g, '-') : undefined;
}

function normalizedTagIdentifier(tag: ActorTag): string | undefined {
  return normalizeIdentifier(tag.key ?? tag.text);
}

function collectTagIdentifiers(tags: ActorTag[] | undefined): Set<string> {
  const identifiers = new Set<string>();
  if (!tags) {
    return identifiers;
  }
  for (const tag of tags) {
    const normalized = normalizedTagIdentifier(tag);
    if (normalized) {
      identifiers.add(normalized);
    }
  }
  return identifiers;
}

function hasConditionFromSources(actor: Actor | undefined, identifiers: Set<string>, condition: RelevantCondition): boolean {
  if (!actor) {
    return false;
  }
  if (hasCondition(actor.conditions, condition)) {
    return true;
  }
  return identifiers.has(`condition-${condition}`);
}

export function computeAdvantageState(
  state: EncounterState | null | undefined,
  attackerId: string,
  defenderId: string,
  mode: AttackMode,
): AdvantageState {
  if (!state) {
    return 'normal';
  }

  const attacker = state.actors[attackerId];
  const defender = state.actors[defenderId];

  if (!attacker || !defender) {
    return 'normal';
  }

  const attackerTags = collectTagIdentifiers(attacker.tags);
  const defenderTags = collectTagIdentifiers(defender.tags);

  const hasAttackerCondition = (condition: RelevantCondition) =>
    hasConditionFromSources(attacker, attackerTags, condition);
  const hasDefenderCondition = (condition: RelevantCondition) =>
    hasConditionFromSources(defender, defenderTags, condition);

  let hasAdvantage = false;
  let hasDisadvantage = false;

  if (attackerTags.has('state-advantage')) {
    hasAdvantage = true;
  }

  if (attackerTags.has('state-disadvantage')) {
    hasDisadvantage = true;
  }

  if (hasAttackerCondition('restrained')) {
    hasDisadvantage = true;
  }

  if (hasAttackerCondition('prone')) {
    hasDisadvantage = true;
  }

  if (hasAttackerCondition('invisible')) {
    hasAdvantage = true;
  }

  if (hasDefenderCondition('restrained')) {
    hasAdvantage = true;
  }

  if (hasDefenderCondition('invisible')) {
    hasDisadvantage = true;
  }

  if (hasDefenderCondition('prone')) {
    if (mode === 'melee') {
      hasAdvantage = true;
    } else if (mode === 'ranged') {
      hasDisadvantage = true;
    }
  }

  if (hasAdvantage && hasDisadvantage) {
    return 'normal';
  }

  if (hasAdvantage) {
    return 'advantage';
  }

  if (hasDisadvantage) {
    return 'disadvantage';
  }

  return 'normal';
}
