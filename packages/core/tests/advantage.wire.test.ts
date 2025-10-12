import { describe, expect, it } from 'vitest';
import { computeAdvantageState } from '../src/advantage.js';
import { actorAttack, createEncounter } from '../src/encounter.js';
import type { ActorTag, EncounterState, MonsterActor, PlayerActor } from '../src/encounter.js';

type SetupOptions = {
  attackerTags?: ActorTag[];
  defenderTags?: ActorTag[];
};

function buildEncounter(options: SetupOptions = {}): {
  state: EncounterState;
  attackerId: string;
  defenderId: string;
} {
  const base = createEncounter('adv-test');
  const attacker: PlayerActor = {
    id: 'attacker',
    name: 'Attacker',
    type: 'pc',
    side: 'party',
    ac: 15,
    hp: 12,
    maxHp: 12,
    abilityMods: {},
    tags: options.attackerTags ?? [],
    defaultWeapon: { name: 'Sword', attackMod: 5, damageExpr: '1d8+3' },
  };

  const defender: MonsterActor = {
    id: 'defender',
    name: 'Defender',
    type: 'monster',
    side: 'foe',
    ac: 13,
    hp: 10,
    maxHp: 10,
    abilityMods: {},
    tags: options.defenderTags ?? [],
    attacks: [{ name: 'Claw', attackMod: 4, damageExpr: '1d6+2' }],
  };

  const state: EncounterState = {
    ...base,
    actors: {
      [attacker.id]: attacker,
      [defender.id]: defender,
    },
  };

  return { state, attackerId: attacker.id, defenderId: defender.id };
}

function advantageTag(id: string, key: string, text: string): ActorTag {
  return {
    id,
    key,
    text,
    addedAtRound: 1,
  };
}

describe('computeAdvantageState', () => {
  it('returns advantage when attacker has a state:advantage tag', () => {
    const { state, attackerId, defenderId } = buildEncounter({
      attackerTags: [advantageTag('t1', 'state:advantage', 'Advantage')],
    });
    expect(computeAdvantageState(state, attackerId, defenderId, 'melee')).toBe('advantage');
  });

  it('returns normal when both advantage and disadvantage tags are present', () => {
    const { state, attackerId, defenderId } = buildEncounter({
      attackerTags: [
        advantageTag('t1', 'state:advantage', 'Advantage'),
        advantageTag('t2', 'state:disadvantage', 'Disadvantage'),
      ],
    });
    expect(computeAdvantageState(state, attackerId, defenderId, 'melee')).toBe('normal');
  });

  it('handles prone targets differently for melee and ranged modes', () => {
    const proneTag = advantageTag('t1', 'condition:prone', 'Prone');
    const { state, attackerId, defenderId } = buildEncounter({ defenderTags: [proneTag] });
    expect(computeAdvantageState(state, attackerId, defenderId, 'melee')).toBe('advantage');
    expect(computeAdvantageState(state, attackerId, defenderId, 'ranged')).toBe('disadvantage');
  });
});

describe('actorAttack with advantage override', () => {
  it('rolls normally when no override is provided', () => {
    const { state, attackerId, defenderId } = buildEncounter({
      attackerTags: [advantageTag('t1', 'state:advantage', 'Advantage')],
    });
    const result = actorAttack(state, attackerId, defenderId, { mode: 'melee', seed: 'normal' });
    expect(result.attack.d20s.length).toBe(1);
  });

  it('rolls with advantage when override is advantage', () => {
    const { state, attackerId, defenderId } = buildEncounter();
    const result = actorAttack(state, attackerId, defenderId, {
      mode: 'melee',
      seed: 'adv',
      advStateOverride: 'advantage',
    });
    expect(result.attack.d20s.length).toBe(2);
    expect(result.attack.natural).toBe(Math.max(...result.attack.d20s));
  });

  it('rolls with disadvantage when override is disadvantage', () => {
    const { state, attackerId, defenderId } = buildEncounter();
    const result = actorAttack(state, attackerId, defenderId, {
      mode: 'melee',
      seed: 'dis',
      advStateOverride: 'disadvantage',
    });
    expect(result.attack.d20s.length).toBe(2);
    expect(result.attack.natural).toBe(Math.min(...result.attack.d20s));
  });

  it('rolls a single die when override is normal', () => {
    const { state, attackerId, defenderId } = buildEncounter();
    const result = actorAttack(state, attackerId, defenderId, {
      mode: 'melee',
      seed: 'normal-override',
      advStateOverride: 'normal',
    });
    expect(result.attack.d20s.length).toBe(1);
  });
});
