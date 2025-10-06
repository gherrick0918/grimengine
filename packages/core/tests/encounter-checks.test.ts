import { describe, expect, it } from 'vitest';

import {
  addActor,
  actorAttack,
  createEncounter,
  encounterAbilityCheck,
  type EncounterState,
  type MonsterActor,
  type PlayerActor,
} from '../src/encounter.js';
import { abilityCheck } from '../src/checks.js';

describe('encounter ability checks', () => {
  function createBaseState(poisoned: boolean): { state: EncounterState; actor: PlayerActor } {
    let state = createEncounter('check-test');
    const actor: PlayerActor = {
      id: 'pc-1',
      name: 'Test Hero',
      side: 'party',
      type: 'pc',
      ac: 15,
      hp: 12,
      maxHp: 12,
      abilityMods: { STR: 3, DEX: 2 },
      proficiencyBonus: 2,
      defaultWeapon: { name: 'Longsword', attackMod: 5, damageExpr: '1d8+3' },
      conditions: poisoned ? { poisoned: true } : undefined,
    };
    state = addActor(state, actor);
    return { state, actor: state.actors[actor.id] as PlayerActor };
  }

  it('performs ability checks without condition effects', () => {
    const { state, actor } = createBaseState(false);
    const seed = 'encounter-check-basic';

    const result = encounterAbilityCheck(state, {
      actorId: actor.id,
      ability: 'STR',
      baseMod: 3,
      dc: 12,
      seed,
    });

    const expected = abilityCheck({ ability: 'STR', modifier: 3, dc: 12, seed });

    expect(result).toEqual(expected);
    expect(result.rolls).toHaveLength(1);
  });

  it('applies disadvantage when the actor is poisoned', () => {
    const { state, actor } = createBaseState(true);
    const seed = 'encounter-check-poisoned';

    const result = encounterAbilityCheck(state, {
      actorId: actor.id,
      ability: 'STR',
      baseMod: 3,
      dc: 12,
      seed,
    });

    const expected = abilityCheck({ ability: 'STR', modifier: 3, disadvantage: true, dc: 12, seed });

    expect(result).toEqual(expected);
    expect(result.rolls).toHaveLength(2);
  });
});

describe('actor attack guards defeated participants', () => {
  function createActors(attackerHp: number, defenderHp: number): EncounterState {
    let state = createEncounter('attack-guard');
    const attacker: PlayerActor = {
      id: 'attacker',
      name: 'Attacker',
      side: 'party',
      type: 'pc',
      ac: 16,
      hp: attackerHp,
      maxHp: 16,
      abilityMods: { STR: 3 },
      proficiencyBonus: 2,
      defaultWeapon: { name: 'Sword', attackMod: 5, damageExpr: '1d8+3' },
    };
    const defender: MonsterActor = {
      id: 'defender',
      name: 'Defender',
      side: 'foe',
      type: 'monster',
      ac: 13,
      hp: defenderHp,
      maxHp: 13,
      abilityMods: { DEX: 2 },
      proficiencyBonus: 2,
      attacks: [{ name: 'Claw', attackMod: 4, damageExpr: '1d6+2' }],
    };

    state = addActor(state, attacker);
    state = addActor(state, defender);
    return state;
  }

  it('throws when the attacker is defeated', () => {
    const state = createActors(0, 10);
    expect(() => actorAttack(state, 'attacker', 'defender')).toThrowError('Attacker is defeated.');
  });

  it('throws when the defender is defeated', () => {
    const state = createActors(10, 0);
    expect(() => actorAttack(state, 'attacker', 'defender')).toThrowError('Target is defeated.');
  });
});
