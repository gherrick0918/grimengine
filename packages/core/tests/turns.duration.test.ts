import { describe, expect, it } from 'vitest';

import {
  addActor,
  addActorTag,
  createEncounter,
  nextTurn,
  previousTurn,
  type EncounterState,
  type PlayerActor,
} from '../src/encounter.js';

function createTestActor(id: string, name: string): PlayerActor {
  return {
    id,
    name,
    side: 'party',
    type: 'pc',
    ac: 15,
    hp: 12,
    maxHp: 12,
    abilityMods: { STR: 2, DEX: 1 },
    proficiencyBonus: 2,
    defaultWeapon: { name: 'Longsword', attackMod: 5, damageExpr: '1d8+3' },
  };
}

function setupEncounter(): EncounterState {
  let encounter = createEncounter('turn-test');
  encounter = addActor(encounter, createTestActor('pc-1', 'Aerin'));
  encounter = addActor(encounter, createTestActor('pc-2', 'Borin'));
  return {
    ...encounter,
    order: [
      { actorId: 'pc-1', rolled: 15, total: 17 },
      { actorId: 'pc-2', rolled: 12, total: 13 },
    ],
    round: 1,
    turnIndex: 0,
  };
}

describe('turn duration handling', () => {
  it('expires tags with turnEnd durations at the end of the owner\'s turn', () => {
    let encounter = setupEncounter();
    encounter = addActorTag(encounter, 'pc-1', {
      key: 'condition:restrained',
      text: 'Restrained',
      value: true,
      duration: { rounds: 1, at: 'turnEnd' },
    });

    encounter = nextTurn(encounter);

    expect(encounter.actors['pc-1']?.tags).toEqual([]);
    expect(encounter.actors['pc-2']?.tags ?? []).toHaveLength(0);
  });

  it('ticks turnStart durations when the actor begins their turn', () => {
    let encounter = setupEncounter();
    encounter = addActorTag(encounter, 'pc-2', {
      key: 'condition:invisible',
      text: 'Invisible',
      value: true,
      duration: { rounds: 2, at: 'turnStart' },
    });

    encounter = nextTurn(encounter);
    const firstTick = encounter.actors['pc-2']?.tags?.[0];
    expect(firstTick?.duration?.rounds).toBe(1);

    encounter = nextTurn(encounter);
    encounter = nextTurn(encounter);

    expect(encounter.actors['pc-2']?.tags).toEqual([]);
  });

  it('does not restore expired tags when moving the turn pointer backwards', () => {
    let encounter = setupEncounter();
    encounter = addActorTag(encounter, 'pc-1', {
      key: 'condition:prone',
      text: 'Prone',
      value: true,
      duration: { rounds: 1, at: 'turnEnd' },
    });

    encounter = nextTurn(encounter);
    expect(encounter.actors['pc-1']?.tags).toEqual([]);

    encounter = previousTurn(encounter);
    expect(encounter.actors['pc-1']?.tags).toEqual([]);
  });
});
