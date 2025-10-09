import { describe, expect, it } from 'vitest';

import {
  addActor,
  createEncounter,
  type EncounterState,
  type PlayerActor,
} from '../src/encounter.js';
import { applyBardicInspiration } from '../src/features/bardicInspiration.js';
import { remindersFor } from '../src/reminders.js';
import { startGuidance } from '../src/spells/guidance.js';

function createTestPc(id: string, name: string): PlayerActor {
  return {
    id,
    name,
    type: 'pc',
    side: 'party',
    ac: 15,
    hp: 12,
    maxHp: 12,
    abilityMods: { STR: 2, DEX: 1 },
    proficiencyBonus: 2,
  };
}

function setupEncounter(): EncounterState {
  let encounter = createEncounter('reminder-test');
  encounter = addActor(encounter, createTestPc('pc-1', 'Aerin'));
  encounter = addActor(encounter, createTestPc('pc-2', 'Borin'));
  encounter = addActor(encounter, createTestPc('pc-3', 'Cirin'));
  return encounter;
}

describe('guidance and bardic inspiration reminders', () => {
  it('includes guidance reminder on checks only', () => {
    let encounter = setupEncounter();
    encounter = startGuidance(encounter, 'pc-1', 'pc-2');

    const checkReminders = remindersFor(encounter, 'pc-2', null, 'check');
    expect(checkReminders).toContain('Reminder: Guidance (+1d4 to this ability check; concentration)');

    const attackReminders = remindersFor(encounter, 'pc-2', 'pc-3', 'attack');
    expect(attackReminders).not.toContain('Reminder: Guidance (+1d4 to this ability check; concentration)');

    const saveReminders = remindersFor(encounter, 'pc-2', null, 'save');
    expect(saveReminders).not.toContain('Reminder: Guidance (+1d4 to this ability check; concentration)');
  });

  it('detects guidance from concentration even if tags are missing', () => {
    let encounter = setupEncounter();
    encounter = startGuidance(encounter, 'pc-1', 'pc-2');

    const guided = encounter.actors['pc-2'];
    encounter = {
      ...encounter,
      actors: {
        ...encounter.actors,
        'pc-2': guided ? { ...guided, tags: [] } : guided,
      },
    };

    const reminders = remindersFor(encounter, 'pc-2', null, 'check');
    expect(reminders).toContain('Reminder: Guidance (+1d4 to this ability check; concentration)');
  });

  it('includes bardic inspiration reminders for all event types with die size', () => {
    let encounter = setupEncounter();
    encounter = applyBardicInspiration(encounter, 'pc-1', 'pc-2', { die: 'd8' });

    const attackReminders = remindersFor(encounter, 'pc-2', 'pc-3', 'attack');
    expect(attackReminders).toContain('Reminder: Bardic Inspiration (+d8 to attack; after seeing roll)');

    const saveReminders = remindersFor(encounter, 'pc-2', null, 'save');
    expect(saveReminders).toContain('Reminder: Bardic Inspiration (+d8 to save; after seeing roll)');

    const checkReminders = remindersFor(encounter, 'pc-2', null, 'check');
    expect(checkReminders).toContain('Reminder: Bardic Inspiration (+d8 to ability check; after seeing roll)');
  });

  it('defaults bardic inspiration die to d6 when not specified', () => {
    let encounter = setupEncounter();
    encounter = applyBardicInspiration(encounter, 'pc-1', 'pc-2');

    const reminders = remindersFor(encounter, 'pc-2', null, 'attack');
    expect(reminders).toContain('Reminder: Bardic Inspiration (+d6 to attack; after seeing roll)');
  });
});
