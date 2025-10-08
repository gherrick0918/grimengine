import { describe, expect, it } from 'vitest';

import {
  addActor,
  createEncounter,
  type EncounterState,
  type PlayerActor,
} from '../src/encounter.js';
import { remindersFor } from '../src/reminders.js';
import { startBless } from '../src/spells/bless.js';
import { startHuntersMark } from '../src/spells/huntersMark.js';

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

describe('remindersFor', () => {
  it('includes bless reminders for attacks and saves', () => {
    let encounter = setupEncounter();
    encounter = startBless(encounter, 'pc-1', ['pc-1']);

    const attackReminders = remindersFor(encounter, 'pc-1', null, 'attack');
    expect(attackReminders).toContain('Reminder: Bless (+d4 to attack roll)');

    const saveReminders = remindersFor(encounter, 'pc-1', null, 'save');
    expect(saveReminders).toContain('Reminder: Bless (+d4 to saving throw)');

    const checkReminders = remindersFor(encounter, 'pc-1', null, 'check');
    expect(checkReminders).toContain('Reminder: Bless (+d4 to ability check)');
  });

  it("includes hunter's mark reminder when attacker marked the target", () => {
    let encounter = setupEncounter();
    encounter = startHuntersMark(encounter, 'pc-1', 'pc-2');

    const reminders = remindersFor(encounter, 'pc-1', 'pc-2', 'attack');
    expect(reminders).toContain("Reminder: Hunter's Mark (+1d6 on hit vs Borin)");
  });

  it("omits hunter's mark reminder when target is unmarked or marked by another", () => {
    let encounter = setupEncounter();
    encounter = startHuntersMark(encounter, 'pc-3', 'pc-2');

    const noTargetMatch = remindersFor(encounter, 'pc-1', 'pc-2', 'attack');
    expect(noTargetMatch).not.toContain("Reminder: Hunter's Mark (+1d6 on hit vs Borin)");

    const missingTarget = remindersFor(encounter, 'pc-1', 'pc-4', 'attack');
    expect(missingTarget).not.toContain("Reminder: Hunter's Mark (+1d6 on hit vs Borin)");

    const otherEvent = remindersFor(encounter, 'pc-3', 'pc-2', 'save');
    expect(otherEvent).not.toContain("Reminder: Hunter's Mark (+1d6 on hit vs Borin)");
  });

  it('detects concentration-based reminders when tags are missing', () => {
    let encounter = setupEncounter();
    encounter = startBless(encounter, 'pc-2', ['pc-1']);
    encounter = startHuntersMark(encounter, 'pc-3', 'pc-2');

    const blessed = encounter.actors['pc-1'];
    const marked = encounter.actors['pc-2'];

    encounter = {
      ...encounter,
      actors: {
        ...encounter.actors,
        'pc-1': blessed ? { ...blessed, tags: [] } : blessed,
        'pc-2': marked ? { ...marked, tags: [] } : marked,
      },
    };

    const blessFromConcentration = remindersFor(encounter, 'pc-1', null, 'attack');
    expect(blessFromConcentration).toContain('Reminder: Bless (+d4 to attack roll)');

    const huntersMarkFromConcentration = remindersFor(encounter, 'pc-3', 'pc-2', 'attack');
    expect(huntersMarkFromConcentration).toContain("Reminder: Hunter's Mark (+1d6 on hit vs Borin)");
  });
});
