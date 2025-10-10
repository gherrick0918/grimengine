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
  let encounter = createEncounter('condition-reminders');
  encounter = addActor(encounter, createTestPc('pc-1', 'Arin'));
  encounter = addActor(encounter, createTestPc('pc-2', 'Bren'));
  return encounter;
}

function applyConditionTag(state: EncounterState, actorId: string, condition: 'prone' | 'restrained' | 'invisible') {
  return addActorTag(state, actorId, {
    key: `condition:${condition}`,
    text: condition,
    value: true,
  });
}

describe('condition reminders', () => {
  it('includes prone reminders for attacker and target', () => {
    let encounter = setupEncounter();
    encounter = applyConditionTag(encounter, 'pc-2', 'prone');
    encounter = applyConditionTag(encounter, 'pc-1', 'prone');

    const reminders = remindersFor(encounter, 'pc-1', 'pc-2', 'attack');
    expect(reminders).toContain(
      'Reminder: Target is Prone (melee attacks: advantage; ranged attacks: disadvantage)',
    );
    expect(reminders).toContain('Reminder: Attacker is Prone (attacks: disadvantage)');
  });

  it('includes restrained reminders for attacks and saves', () => {
    let encounter = setupEncounter();
    encounter = applyConditionTag(encounter, 'pc-2', 'restrained');
    encounter = applyConditionTag(encounter, 'pc-1', 'restrained');

    const attackReminders = remindersFor(encounter, 'pc-1', 'pc-2', 'attack');
    expect(attackReminders).toContain('Reminder: Target is Restrained (attacks against it: advantage)');
    expect(attackReminders).toContain('Reminder: Attacker is Restrained (attacks: disadvantage)');

    const saveReminders = remindersFor(encounter, 'pc-1', 'pc-2', 'save');
    expect(saveReminders).toContain('Reminder: Restrained (DEX saves: disadvantage)');
  });

  it('includes invisible reminders for attacker and target', () => {
    let encounter = setupEncounter();
    encounter = applyConditionTag(encounter, 'pc-2', 'invisible');
    encounter = applyConditionTag(encounter, 'pc-1', 'invisible');

    const reminders = remindersFor(encounter, 'pc-1', 'pc-2', 'attack');
    expect(reminders).toContain('Reminder: Target is Invisible (attacks against it: disadvantage)');
    expect(reminders).toContain('Reminder: Attacker is Invisible (attacks: advantage)');
  });
});
