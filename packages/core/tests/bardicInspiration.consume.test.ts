import { describe, expect, it } from 'vitest';

import {
  addActor,
  createEncounter,
  type EncounterState,
  type PlayerActor,
} from '../src/encounter.js';
import {
  applyBardicInspiration,
  bardicInspirationDieFromTag,
  consumeBardicInspiration,
  getBardicInspirationTag,
} from '../src/features/bardicInspiration.js';
import { remindersFor } from '../src/reminders.js';

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
  let encounter = createEncounter('bardic-consume-test');
  encounter = addActor(encounter, createTestPc('pc-1', 'Bard'));
  encounter = addActor(encounter, createTestPc('pc-2', 'Target'));
  return encounter;
}

describe('bardic inspiration consumption helpers', () => {
  it('auto-clear inspiration is removed when consumed', () => {
    let encounter = setupEncounter();
    encounter = applyBardicInspiration(encounter, 'pc-1', 'pc-2', { die: 'd8', autoClear: true });

    const reminders = remindersFor(encounter, 'pc-2', null, 'attack');
    expect(reminders).toContain(
      'Reminder: Bardic Inspiration (+d8 to attack; after seeing roll; auto-clear)',
    );

    const consumption = consumeBardicInspiration(encounter, 'pc-2', { autoOnly: true });
    expect(consumption.consumed).toBe(true);
    encounter = consumption.state;

    expect(getBardicInspirationTag(encounter.actors['pc-2']?.tags)).toBeUndefined();
  });

  it('manual consumption returns the removed tag and clears it', () => {
    let encounter = setupEncounter();
    encounter = applyBardicInspiration(encounter, 'pc-1', 'pc-2', { die: 'd10' });

    const autoAttempt = consumeBardicInspiration(encounter, 'pc-2', { autoOnly: true });
    expect(autoAttempt.consumed).toBe(false);

    const consumption = consumeBardicInspiration(encounter, 'pc-2');
    expect(consumption.consumed).toBe(true);
    expect(consumption.removedTag).toBeDefined();

    const die = bardicInspirationDieFromTag(consumption.removedTag);
    expect(die).toBe('d10');

    encounter = consumption.state;
    expect(getBardicInspirationTag(encounter.actors['pc-2']?.tags)).toBeUndefined();
  });
});
