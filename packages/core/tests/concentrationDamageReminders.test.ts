import { describe, expect, test } from 'vitest';

import { concentrationReminderLinesForDamage } from '../src/concentrationReminders.js';
import { createEncounter, startConcentration, type EncounterState } from '../src/encounter.js';

describe('concentrationReminderLinesForDamage', () => {
  test('prints DC 10 when damage is below 20', () => {
    const encounter = startConcentration(createEncounter(), {
      casterId: 'pc-1',
      spellName: 'Bless',
    });

    const lines = concentrationReminderLinesForDamage(encounter, 'pc-1', 7);
    expect(lines).toEqual(['Reminder: Concentration check DC 10 for Bless']);
  });

  test('prints half-damage DC when damage is 20 or higher', () => {
    const encounter = startConcentration(createEncounter(), {
      casterId: 'pc-2',
      spellName: 'Summon Minor Elementals',
    });

    const lines = concentrationReminderLinesForDamage(encounter, 'pc-2', 26);
    expect(lines).toEqual(['Reminder: Concentration check DC 13 for Summon Minor Elementals']);
  });

  test('returns empty array when actor has no concentration entries', () => {
    const encounter = createEncounter();
    expect(concentrationReminderLinesForDamage(encounter, 'pc-3', 12)).toEqual([]);
  });

  test('supports multiple concentration entries for the same actor', () => {
    const base = createEncounter();
    const encounter: EncounterState = {
      ...base,
      concentration: {
        primary: { casterId: 'pc-1', spellName: 'Bless' },
        secondary: { casterId: 'pc-1', spellName: 'Fly' },
      },
    };

    const lines = concentrationReminderLinesForDamage(encounter, 'pc-1', 12);
    expect(lines).toEqual([
      'Reminder: Concentration check DC 10 for Bless',
      'Reminder: Concentration check DC 10 for Fly',
    ]);
  });
});
