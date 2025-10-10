import type { ActorTag, EncounterState } from './encounter.js';
import { hasCondition } from './conditions.js';
import {
  bardicInspirationAutoClears,
  bardicInspirationDieFromTag,
  getBardicInspirationTag,
} from './features/bardicInspiration.js';

export type ReminderEvent = 'attack' | 'save' | 'check';

const BLESS_KEY = 'spell:bless';
const HUNTERS_MARK_KEY = "spell:hunters-mark";
const GUIDANCE_KEY = 'spell:guidance';
const GUIDANCE_NAME = 'Guidance';

function normalizeText(text: string | undefined): string | undefined {
  return text ? text.toLowerCase().replace(/[^a-z0-9]+/g, '-') : undefined;
}

function isBlessTag(tag: ActorTag): boolean {
  const key = tag.key?.toLowerCase();
  if (key === BLESS_KEY) {
    return true;
  }
  const normalizedText = normalizeText(tag.text);
  return normalizedText === 'bless';
}

function hasBlessFromTags(tags: ActorTag[] | undefined): boolean {
  if (!tags || tags.length === 0) {
    return false;
  }
  return tags.some((tag) => isBlessTag(tag));
}

function hasBlessFromConcentration(state: EncounterState, actorId: string): boolean {
  const entries = state.concentration ? Object.values(state.concentration) : [];
  for (const entry of entries) {
    if (entry.spellName.toLowerCase() !== 'bless') {
      continue;
    }
    if (entry.targetIds && entry.targetIds.includes(actorId)) {
      return true;
    }
    if (entry.targetId && entry.targetId === actorId) {
      return true;
    }
  }
  return false;
}

function isHuntersMarkTag(tag: ActorTag, expectedSources: Set<string>): boolean {
  const key = tag.key?.toLowerCase();
  if (key && key !== HUNTERS_MARK_KEY) {
    return false;
  }

  const normalizedText = normalizeText(tag.text);
  if (!key && normalizedText !== 'hunter-s-mark') {
    return false;
  }

  if (!tag.source) {
    return true;
  }
  return expectedSources.has(tag.source);
}

function hasHuntersMarkFromTags(tags: ActorTag[] | undefined, expectedSources: Set<string>): boolean {
  if (!tags || tags.length === 0) {
    return false;
  }

  return tags.some((tag) => isHuntersMarkTag(tag, expectedSources));
}

function hasHuntersMarkFromConcentration(state: EncounterState, casterId: string, targetId: string): boolean {
  const entry = state.concentration?.[casterId];
  if (!entry) {
    return false;
  }
  if (entry.spellName.toLowerCase() !== "hunter's mark") {
    return false;
  }
  if (entry.targetId && entry.targetId === targetId) {
    return true;
  }
  if (entry.targetIds && entry.targetIds.includes(targetId)) {
    return true;
  }
  return false;
}

function isGuidanceTag(tag: ActorTag): boolean {
  const key = tag.key?.toLowerCase();
  if (key === GUIDANCE_KEY) {
    return true;
  }
  const normalizedText = normalizeText(tag.text);
  return normalizedText === GUIDANCE_KEY || normalizedText === GUIDANCE_NAME.toLowerCase();
}

function hasGuidanceFromTags(tags: ActorTag[] | undefined): boolean {
  if (!tags || tags.length === 0) {
    return false;
  }
  return tags.some((tag) => isGuidanceTag(tag));
}

function hasGuidanceFromConcentration(state: EncounterState, actorId: string): boolean {
  const entries = state.concentration ? Object.values(state.concentration) : [];
  for (const entry of entries) {
    if (entry.spellName.toLowerCase() !== GUIDANCE_NAME.toLowerCase()) {
      continue;
    }
    if (entry.targetId && entry.targetId === actorId) {
      return true;
    }
    if (entry.targetIds && entry.targetIds.includes(actorId)) {
      return true;
    }
  }
  return false;
}

function normalizedTagIdentifier(tag: ActorTag): string | undefined {
  return normalizeText(tag.key ?? tag.text);
}

function conditionTagIdentifiers(tags: ActorTag[] | undefined): Set<string> | undefined {
  if (!tags || tags.length === 0) {
    return undefined;
  }

  const identifiers = new Set<string>();
  for (const tag of tags) {
    const normalized = normalizedTagIdentifier(tag);
    if (normalized?.startsWith('condition-')) {
      identifiers.add(normalized);
    }
  }
  return identifiers.size > 0 ? identifiers : undefined;
}

function hasConditionTag(
  identifiers: Set<string> | undefined,
  condition: string,
): boolean {
  if (!identifiers || identifiers.size === 0) {
    return false;
  }
  const expected = `condition-${condition}`;
  return identifiers.has(expected);
}

export function remindersFor(
  encounter: EncounterState,
  attackerId: string,
  targetId: string | null,
  event: ReminderEvent,
): string[] {
  const attacker = encounter.actors[attackerId];
  if (!attacker) {
    return [];
  }

  const reminders: string[] = [];
  const blessActive = hasBlessFromTags(attacker.tags) || hasBlessFromConcentration(encounter, attackerId);

  if (blessActive) {
    if (event === 'attack') {
      reminders.push('Reminder: Bless (+d4 to attack roll)');
    } else if (event === 'save') {
      reminders.push('Reminder: Bless (+d4 to saving throw)');
    } else if (event === 'check') {
      reminders.push('Reminder: Bless (+d4 to ability check)');
    }
  }

  if (targetId) {
    const target = encounter.actors[targetId];
    const expectedSources = new Set([`conc:${attackerId}:hunters-mark`, `conc:${attackerId}:Hunter's Mark`]);

    const hasHuntersMark =
      hasHuntersMarkFromTags(target?.tags, expectedSources) ||
      hasHuntersMarkFromConcentration(encounter, attackerId, targetId);

    if (hasHuntersMark && event === 'attack') {
      const targetName = target?.name ?? 'target';
      reminders.push(`Reminder: Hunter's Mark (+1d6 on hit vs ${targetName})`);
    }
  }

  const guidanceActive =
    event === 'check' &&
    (hasGuidanceFromTags(attacker.tags) || hasGuidanceFromConcentration(encounter, attackerId));

  if (guidanceActive) {
    reminders.push('Reminder: Guidance (+1d4 to this ability check; concentration)');
  }

  const bardicTag = getBardicInspirationTag(attacker.tags);
  if (bardicTag) {
    const die = bardicInspirationDieFromTag(bardicTag);
    const autoSuffix = bardicInspirationAutoClears(bardicTag) ? '; auto-clear' : '';
    if (event === 'attack') {
      reminders.push(`Reminder: Bardic Inspiration (+${die} to attack; after seeing roll${autoSuffix})`);
    } else if (event === 'save') {
      reminders.push(`Reminder: Bardic Inspiration (+${die} to save; after seeing roll${autoSuffix})`);
    } else if (event === 'check') {
      reminders.push(`Reminder: Bardic Inspiration (+${die} to ability check; after seeing roll${autoSuffix})`);
    }
  }

  const normalizedAttackerTags = (attacker.tags ?? [])
    .map((tag) => normalizedTagIdentifier(tag))
    .filter((value): value is string => Boolean(value));

  const hasAdvantage = normalizedAttackerTags.includes('state-advantage');
  const hasDisadvantage = normalizedAttackerTags.includes('state-disadvantage');

  if (hasAdvantage && hasDisadvantage) {
    reminders.push('Reminder: Advantage & Disadvantage both present — they cancel out (roll normally)');
  } else if (hasAdvantage) {
    if (event === 'attack') {
      reminders.push('Reminder: Advantage on this attack');
    }
    if (event === 'save') {
      reminders.push('Reminder: Advantage on this save');
    }
    if (event === 'check') {
      reminders.push('Reminder: Advantage on this check');
    }
  } else if (hasDisadvantage) {
    if (event === 'attack') {
      reminders.push('Reminder: Disadvantage on this attack');
    }
    if (event === 'save') {
      reminders.push('Reminder: Disadvantage on this save');
    }
    if (event === 'check') {
      reminders.push('Reminder: Disadvantage on this check');
    }
  }

  const target = targetId ? encounter.actors[targetId] : undefined;

  const attackerConditionTags = conditionTagIdentifiers(attacker.tags);
  const targetConditionTags = conditionTagIdentifiers(target?.tags);

  if (event === 'attack') {
    if (hasCondition(target?.conditions, 'prone') || hasConditionTag(targetConditionTags, 'prone')) {
      reminders.push(
        'Reminder: Target is Prone (melee attacks: advantage; ranged attacks: disadvantage)',
      );
    }
    if (hasCondition(attacker.conditions, 'prone') || hasConditionTag(attackerConditionTags, 'prone')) {
      reminders.push('Reminder: Attacker is Prone (attacks: disadvantage)');
    }

    if (
      hasCondition(target?.conditions, 'restrained') ||
      hasConditionTag(targetConditionTags, 'restrained')
    ) {
      reminders.push('Reminder: Target is Restrained (attacks against it: advantage)');
    }
    if (
      hasCondition(attacker.conditions, 'restrained') ||
      hasConditionTag(attackerConditionTags, 'restrained')
    ) {
      reminders.push('Reminder: Attacker is Restrained (attacks: disadvantage)');
    }

    if (
      hasCondition(target?.conditions, 'invisible') ||
      hasConditionTag(targetConditionTags, 'invisible')
    ) {
      reminders.push('Reminder: Target is Invisible (attacks against it: disadvantage)');
    }
    if (
      hasCondition(attacker.conditions, 'invisible') ||
      hasConditionTag(attackerConditionTags, 'invisible')
    ) {
      reminders.push('Reminder: Attacker is Invisible (attacks: advantage)');
    }
  }

  if (
    event === 'save' &&
    (hasCondition(attacker.conditions, 'restrained') || hasConditionTag(attackerConditionTags, 'restrained'))
  ) {
    reminders.push('Reminder: Restrained (DEX saves: disadvantage)');
  }

  return reminders;
}
