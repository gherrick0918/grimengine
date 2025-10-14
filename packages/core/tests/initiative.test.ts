import { describe, expect, it } from 'vitest';
import {
  addActor,
  clearInitiative,
  createEncounter,
  currentActor,
  nextTurn,
  rollInitiative,
  setInitiative,
  type PlayerActor,
} from '../src/encounter.js';

function createTestActor(id: string, name: string, dex: number): PlayerActor {
  return {
    id,
    name,
    side: 'party',
    type: 'pc',
    ac: 12,
    hp: 10,
    maxHp: 10,
    abilityMods: { DEX: dex },
    proficiencyBonus: 2,
    defaultWeapon: { name: 'Unarmed', attackMod: 2, damageExpr: '1d4+2' },
  };
}

describe('initiative helpers', () => {
  it('rollInitiative populates and sorts entries by total', () => {
    let encounter = createEncounter('initiative-test');
    encounter = addActor(encounter, createTestActor('pc-1', 'Alpha', 2));
    encounter = addActor(encounter, createTestActor('pc-2', 'Bravo', 4));
    encounter = addActor(encounter, createTestActor('pc-3', 'Charlie', 0));

    encounter = rollInitiative(encounter);

    expect(encounter.order).toHaveLength(3);
    const totals = encounter.order.map((entry) => entry.total);
    const sorted = [...totals].sort((a, b) => b - a);
    expect(totals).toEqual(sorted);
  });

  it('setInitiative inserts or updates scores while keeping sort order', () => {
    let encounter = createEncounter();
    encounter = addActor(encounter, createTestActor('pc-1', 'Alpha', 0));
    encounter = addActor(encounter, createTestActor('pc-2', 'Bravo', 0));

    encounter = setInitiative(encounter, 'pc-1', 12);
    encounter = setInitiative(encounter, 'pc-2', 15);
    expect(encounter.order.map((entry) => entry.actorId)).toEqual(['pc-2', 'pc-1']);

    encounter = setInitiative(encounter, 'pc-1', 18);
    expect(encounter.order.map((entry) => entry.actorId)).toEqual(['pc-1', 'pc-2']);

    encounter = clearInitiative(encounter);
    expect(encounter.order).toHaveLength(0);
  });

  it('nextTurn advances even when no initiative order is set', () => {
    let encounter = createEncounter();
    encounter = addActor(encounter, createTestActor('pc-1', 'Alpha', 0));
    encounter = addActor(encounter, createTestActor('pc-2', 'Bravo', 0));

    expect(encounter.order).toHaveLength(0);
    expect(currentActor(encounter)?.id).toBe('pc-1');

    encounter = nextTurn(encounter);
    expect(encounter.round).toBe(1);
    expect(encounter.turnIndex).toBe(1);
    expect(currentActor(encounter)?.id).toBe('pc-2');

    encounter = nextTurn(encounter);
    expect(encounter.round).toBe(2);
    expect(encounter.turnIndex).toBe(0);
    expect(currentActor(encounter)?.id).toBe('pc-1');
  });
});
