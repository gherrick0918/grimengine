import { concentrationDCFromDamage } from './encounter.js';
import type { ConcentrationEntry, EncounterState } from './encounter.js';

function getConcentrationEntriesForActor(
  encounter: EncounterState | null | undefined,
  actorId: string,
): ConcentrationEntry[] {
  if (!encounter?.concentration) {
    return [];
  }
  const entries = Object.values(encounter.concentration);
  if (entries.length === 0) {
    return [];
  }
  return entries.filter((entry) => entry.casterId === actorId);
}

export function concentrationReminderLinesForDamage(
  encounter: EncounterState | null | undefined,
  actorId: string,
  damage: number,
): string[] {
  if (!encounter || damage <= 0) {
    return [];
  }

  const entries = getConcentrationEntriesForActor(encounter, actorId);
  if (entries.length === 0) {
    return [];
  }

  const dc = concentrationDCFromDamage(damage);
  return entries.map((entry) => {
    const name = entry.spellName || 'spell';
    return `Reminder: Concentration check DC ${dc} for ${name}`;
  });
}
