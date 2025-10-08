import type { ActorTag, EncounterState } from './encounter.js';

export type ReminderEvent = 'attack' | 'save' | 'check';

const BLESS_KEY = 'spell:bless';
const HUNTERS_MARK_KEY = "spell:hunters-mark";

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

  return reminders;
}
