import { describe, expect, it } from 'vitest';

import {
  addActor,
  addActorTag,
  createEncounter,
  type EncounterState,
  type PlayerActor,
} from '../src/encounter.js';
import { remindersFor } from '../src/reminders.js';

function createTestPc(id: string, name: string): PlayerActor {
  return {
    id,
    name,
    type: 'pc',
    side: 'party',
    ac: 15,
    hp: 10,
    maxHp: 10,
    abilityMods: { STR: 2, DEX: 1 },
    proficiencyBonus: 2,
  };
}

function setupEncounter(): EncounterState {
  let encounter = createEncounter('adv-dis-reminders');
  encounter = addActor(encounter, createTestPc('pc-1', 'Aerin'));
  encounter = addActor(encounter, createTestPc('pc-2', 'Borin'));
  return encounter;
}

describe('advantage/disadvantage reminders', () => {
  it('includes advantage reminders for attack/save/check', () => {
    let encounter = setupEncounter();
    encounter = addActorTag(encounter, 'pc-1', { key: 'state:advantage', value: true });

    const attack = remindersFor(encounter, 'pc-1', 'pc-2', 'attack');
    const save = remindersFor(encounter, 'pc-1', null, 'save');
    const check = remindersFor(encounter, 'pc-1', null, 'check');

    expect(attack).toContain('Reminder: Advantage on this attack');
    expect(save).toContain('Reminder: Advantage on this save');
    expect(check).toContain('Reminder: Advantage on this check');
  });

  it('includes disadvantage reminders for attack/save/check', () => {
    let encounter = setupEncounter();
    encounter = addActorTag(encounter, 'pc-1', { key: 'state:disadvantage', value: true });

    const attack = remindersFor(encounter, 'pc-1', 'pc-2', 'attack');
    const save = remindersFor(encounter, 'pc-1', null, 'save');
    const check = remindersFor(encounter, 'pc-1', null, 'check');

    expect(attack).toContain('Reminder: Disadvantage on this attack');
    expect(save).toContain('Reminder: Disadvantage on this save');
    expect(check).toContain('Reminder: Disadvantage on this check');
  });

  it('includes cancellation reminder when both advantage and disadvantage are present', () => {
    let encounter = setupEncounter();
    encounter = addActorTag(encounter, 'pc-1', { key: 'state:advantage', value: true });
    encounter = addActorTag(encounter, 'pc-1', { key: 'state:disadvantage', value: true });

    const reminders = remindersFor(encounter, 'pc-1', 'pc-2', 'attack');

    expect(reminders).toContain(
      'Reminder: Advantage & Disadvantage both present — they cancel out (roll normally)',
    );
    expect(reminders).not.toContain('Reminder: Advantage on this attack');
    expect(reminders).not.toContain('Reminder: Disadvantage on this attack');
  });
});
