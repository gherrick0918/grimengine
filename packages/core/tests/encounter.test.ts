import { describe, expect, it } from 'vitest';
import {
  addActor,
  actorAttack,
  createEncounter,
  currentActor,
  nextTurn,
  removeActor,
  rollInitiative,
  type EncounterState,
  type MonsterActor,
  type PlayerActor,
} from '../src/encounter.js';

function createGoblin(id: string, name: string): MonsterActor {
  return {
    id,
    name,
    side: 'foe',
    type: 'monster',
    ac: 15,
    hp: 7,
    maxHp: 7,
    abilityMods: { DEX: 2, STR: -1 },
    proficiencyBonus: 2,
    attacks: [
      { name: 'Scimitar', attackMod: 4, damageExpr: '1d6+2' },
      { name: 'Shortbow', attackMod: 4, damageExpr: '1d6+2' },
    ],
  };
}

function createPc(id: string, name: string): PlayerActor {
  return {
    id,
    name,
    side: 'party',
    type: 'pc',
    ac: 14,
    hp: 12,
    maxHp: 12,
    abilityMods: { STR: 3, DEX: 2 },
    proficiencyBonus: 2,
    defaultWeapon: { name: 'Longsword', attackMod: 5, damageExpr: '1d8+3', versatileExpr: '1d10+3' },
  };
}

function setupEncounter(): EncounterState {
  let encounter = createEncounter('encounter-seed');
  encounter = addActor(encounter, createGoblin('goblin-1', 'Goblin #1'));
  encounter = addActor(encounter, createGoblin('goblin-2', 'Goblin #2'));
  encounter = addActor(encounter, createPc('pc-1', 'Aerin'));
  return encounter;
}

describe('encounter initiative and turn order', () => {
  it('rolls initiative deterministically and advances rounds', () => {
    let encounter = setupEncounter();
    encounter = rollInitiative(encounter);

    expect(encounter.round).toBe(1);
    expect(encounter.order).toHaveLength(3);
    expect(encounter.order.map((entry) => entry.actorId)).toEqual(['pc-1', 'goblin-2', 'goblin-1']);

    const first = currentActor(encounter);
    expect(first?.id).toBe('pc-1');

    encounter = nextTurn(encounter);
    expect(encounter.round).toBe(1);
    expect(currentActor(encounter)?.id).toBe('goblin-2');

    encounter = nextTurn(encounter);
    expect(encounter.round).toBe(1);
    expect(currentActor(encounter)?.id).toBe('goblin-1');

    encounter = nextTurn(encounter);
    expect(encounter.round).toBe(2);
    expect(currentActor(encounter)?.id).toBe('pc-1');
  });
});

describe('encounter attacks', () => {
  it('applies damage and tracks defeated actors', () => {
    let encounter = setupEncounter();
    encounter = rollInitiative(encounter);

    const firstAttack = actorAttack(encounter, 'goblin-1', 'pc-1', { seed: 'attack-basic' });
    encounter = firstAttack.state;
    expect(firstAttack.attack.hit).toBe(true);
    expect(firstAttack.damage?.finalTotal).toBe(3);
    expect(firstAttack.defenderHp).toBe(9);
    expect(encounter.actors['pc-1']?.hp).toBe(9);
    expect(encounter.defeated.has('pc-1')).toBe(false);

    const secondAttack = actorAttack(encounter, 'goblin-1', 'pc-1', { seed: 'adv-seed', advantage: true });
    encounter = secondAttack.state;
    expect(secondAttack.attack.hit).toBe(true);
    expect(secondAttack.damage?.finalTotal).toBe(7);
    expect(secondAttack.defenderHp).toBe(2);
    expect(encounter.actors['pc-1']?.hp).toBe(2);
    expect(encounter.defeated.has('pc-1')).toBe(false);

    const finishingAttack = actorAttack(encounter, 'goblin-1', 'pc-1', { seed: 'finish-1' });
    encounter = finishingAttack.state;
    expect(finishingAttack.attack.hit).toBe(true);
    expect(finishingAttack.damage?.finalTotal).toBe(4);
    expect(finishingAttack.defenderHp).toBe(0);
    expect(encounter.actors['pc-1']?.hp).toBe(0);
    expect(encounter.defeated.has('pc-1')).toBe(true);

    encounter = nextTurn(encounter);
    expect(currentActor(encounter)?.id).toBe('goblin-2');
  });

  it('removes actors from the encounter', () => {
    let encounter = setupEncounter();
    encounter = rollInitiative(encounter);

    encounter = removeActor(encounter, 'goblin-2');
    expect(encounter.actors['goblin-2']).toBeUndefined();
    expect(encounter.order.map((entry) => entry.actorId)).toEqual(['pc-1', 'goblin-1']);

    encounter = nextTurn(encounter);
    expect(currentActor(encounter)?.id).toBe('goblin-1');
  });
});
