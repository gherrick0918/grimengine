import type { EncounterState } from './encounter.js';

export type ReminderEvent = 'attack' | 'save' | 'check';

function blessSourceKeys(casterId: string): string[] {
  return [`conc:${casterId}:bless`, `conc:${casterId}:Bless`, casterId];
}

function huntersMarkSourceKeys(casterId: string): string[] {
  return [`conc:${casterId}:hunters-mark`, `conc:${casterId}:Hunter's Mark`];
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
  const attackerTags = attacker.tags ?? [];

  if (attackerTags.some((tag) => tag.key === 'spell:bless')) {
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
    const targetTags = target?.tags ?? [];
    const expectedSources = new Set(huntersMarkSourceKeys(attackerId));

    const hasHuntersMark = targetTags.some(
      (tag) => tag.key === 'spell:hunters-mark' && (!tag.source || expectedSources.has(tag.source)),
    );

    if (hasHuntersMark && event === 'attack') {
      const targetName = target?.name ?? 'target';
      reminders.push(`Reminder: Hunter's Mark (+1d6 on hit vs ${targetName})`);
    }
  }

  return reminders;
}
