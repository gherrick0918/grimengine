import { describe, expect, it } from 'vitest';
import {
  addCondition,
  removeCondition,
  hasCondition,
  attackAdvFromConditions,
  combineAdvantage,
  type ConditionSet,
} from '../src/conditions.js';
import { addActor, actorAttack, createEncounter, type MonsterActor } from '../src/encounter.js';

function createTestMonster(id: string, overrides: Partial<MonsterActor> = {}): MonsterActor {
  return {
    id,
    name: id,
    side: overrides.side ?? 'foe',
    type: 'monster',
    ac: overrides.ac ?? 12,
    hp: overrides.hp ?? 10,
    maxHp: overrides.maxHp ?? 10,
    abilityMods: overrides.abilityMods ?? {},
    proficiencyBonus: overrides.proficiencyBonus ?? 2,
    attacks: overrides.attacks ?? [{ name: 'Strike', attackMod: 5, damageExpr: '1d6+3' }],
    conditions: overrides.conditions,
  };
}

describe('condition helpers', () => {
  it('adds, checks, and removes conditions', () => {
    let set: ConditionSet | undefined;
    set = addCondition(set, 'prone');
    expect(hasCondition(set, 'prone')).toBe(true);

    set = addCondition(set, 'poisoned');
    expect(sortedKeys(set)).toEqual(['poisoned', 'prone']);

    set = removeCondition(set, 'prone');
    expect(hasCondition(set, 'prone')).toBe(false);
    expect(sortedKeys(set)).toEqual(['poisoned']);

    set = removeCondition(set, 'poisoned');
    expect(set).toBeUndefined();
  });
});

describe('attackAdvFromConditions', () => {
  it('handles prone defenders for melee attacks', () => {
    const result = attackAdvFromConditions(undefined, { prone: true }, 'melee');
    expect(result).toEqual({ advantage: true });
  });

  it('handles prone defenders for ranged attacks', () => {
    const result = attackAdvFromConditions(undefined, { prone: true }, 'ranged');
    expect(result).toEqual({ disadvantage: true });
  });

  it('grants advantage against restrained defenders', () => {
    const result = attackAdvFromConditions(undefined, { restrained: true }, 'melee');
    expect(result).toEqual({ advantage: true });
  });

  it('applies disadvantage to restrained attackers', () => {
    const result = attackAdvFromConditions({ restrained: true }, undefined, 'melee');
    expect(result).toEqual({ disadvantage: true });
  });

  it('applies disadvantage to poisoned attackers', () => {
    const result = attackAdvFromConditions({ poisoned: true }, undefined, 'melee');
    expect(result).toEqual({ disadvantage: true });
  });

  it('can produce both advantage and disadvantage', () => {
    const result = attackAdvFromConditions({ restrained: true }, { restrained: true }, 'melee');
    expect(result).toEqual({ advantage: true, disadvantage: true });
  });
});

describe('combineAdvantage', () => {
  it('cancels opposing advantage and disadvantage', () => {
    const result = combineAdvantage({}, { advantage: true, disadvantage: true });
    expect(result).toEqual({});
  });

  it('merges user-provided and condition flags', () => {
    const result = combineAdvantage({ advantage: true }, { disadvantage: true });
    expect(result).toEqual({});
  });
});

describe('actorAttack integration with conditions', () => {
  it('rolls with advantage when the defender is restrained', () => {
    const attacker = createTestMonster('attacker');
    const defender = createTestMonster('defender', { side: 'party', conditions: { restrained: true } });

    let encounter = createEncounter('adv-condition');
    encounter = addActor(encounter, attacker);
    encounter = addActor(encounter, defender);

    const result = actorAttack(encounter, attacker.id, defender.id, { seed: 'grim' });
    expect(result.attack.d20s.length).toBe(2);
    const [first, second] = result.attack.d20s;
    expect(result.attack.natural).toBe(Math.max(first, second));
    expect(result.attack.expression).toContain('adv');
  });

  it('rolls with disadvantage when the attacker is poisoned', () => {
    const attacker = createTestMonster('attacker', { conditions: { poisoned: true } });
    const defender = createTestMonster('defender', { side: 'party' });

    let encounter = createEncounter('dis-condition');
    encounter = addActor(encounter, attacker);
    encounter = addActor(encounter, defender);

    const result = actorAttack(encounter, attacker.id, defender.id, { seed: 'grim' });
    expect(result.attack.d20s.length).toBe(2);
    const [first, second] = result.attack.d20s;
    expect(result.attack.natural).toBe(Math.min(first, second));
    expect(result.attack.expression).toContain('dis');
  });
});

function sortedKeys(set: ConditionSet | undefined): string[] {
  return set ? Object.keys(set).sort() : [];
}
