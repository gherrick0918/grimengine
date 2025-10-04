import { describe, expect, it } from 'vitest';

import {
  chooseAttackAbility,
  resolveWeaponAttack,
  type AbilityMods,
  type Weapon,
} from '../src/weapons.js';

const DAGGER: Weapon = {
  name: 'Dagger',
  category: 'simple',
  type: 'melee',
  damage: { expression: '1d4+0', type: 'piercing' },
  properties: { finesse: true, light: true, thrown: { normal: 20, long: 60 } },
};

const RAPIER: Weapon = {
  name: 'Rapier',
  category: 'martial',
  type: 'melee',
  damage: { expression: '1d8+0', type: 'piercing' },
  properties: { finesse: true },
};

const HANDAXE: Weapon = {
  name: 'Handaxe',
  category: 'simple',
  type: 'melee',
  damage: { expression: '1d6+0', type: 'slashing' },
  properties: { thrown: { normal: 20, long: 60 }, light: true },
};

const LONGBOW: Weapon = {
  name: 'Longbow',
  category: 'martial',
  type: 'ranged',
  damage: { expression: '1d8+0', type: 'piercing' },
  properties: { ammunition: true, heavy: true, twoHanded: true },
  range: { normal: 150, long: 600 },
};

const LONGSWORD: Weapon = {
  name: 'Longsword',
  category: 'martial',
  type: 'melee',
  damage: { expression: '1d8+0', type: 'slashing' },
  versatile: { expression: '1d10+0' },
};

describe('chooseAttackAbility', () => {
  it('uses the higher modifier for finesse weapons', () => {
    const abilities: AbilityMods = { STR: 1, DEX: 4 };
    expect(chooseAttackAbility(DAGGER, abilities)).toBe('DEX');
    expect(chooseAttackAbility(RAPIER, abilities)).toBe('DEX');
  });

  it('uses strength for non-finesse thrown melee weapons', () => {
    const abilities: AbilityMods = { STR: 3, DEX: 4 };
    expect(chooseAttackAbility(HANDAXE, abilities, { thrown: true })).toBe('STR');
  });

  it('uses dexterity for ranged weapons', () => {
    const abilities: AbilityMods = { STR: 3, DEX: 4 };
    expect(chooseAttackAbility(LONGBOW, abilities)).toBe('DEX');
  });
});

describe('resolveWeaponAttack', () => {
  it('applies proficiency bonus when proficient', () => {
    const abilities: AbilityMods = { STR: 3 };
    const proficient = resolveWeaponAttack({
      weapon: LONGSWORD,
      abilities,
      proficiencies: { martial: true },
      proficiencyBonus: 2,
      seed: 'proficiency-test',
    });

    const notProficient = resolveWeaponAttack({
      weapon: LONGSWORD,
      abilities,
      seed: 'proficiency-test',
    });

    expect(proficient.attack.natural).toBe(notProficient.attack.natural);
    expect(proficient.attack.total).toBe(notProficient.attack.total + 2);
  });

  it('uses versatile damage when two-handed', () => {
    const abilities: AbilityMods = { STR: 3 };
    const oneHanded = resolveWeaponAttack({
      weapon: LONGSWORD,
      abilities,
      seed: 'versatile-test',
    });

    const twoHanded = resolveWeaponAttack({
      weapon: LONGSWORD,
      abilities,
      twoHanded: true,
      seed: 'versatile-test',
    });

    expect(oneHanded.damage?.expression).toBe('1d8+3');
    expect(twoHanded.damage?.expression).toBe('1d10+3');
  });

  it('produces deterministic attack and damage rolls with a seed', () => {
    const result = resolveWeaponAttack({
      weapon: LONGSWORD,
      abilities: { STR: 3 },
      proficiencies: { martial: true },
      proficiencyBonus: 2,
      twoHanded: true,
      advantage: true,
      targetAC: 10,
      seed: 'e2e-seed',
    });
    const repeat = resolveWeaponAttack({
      weapon: LONGSWORD,
      abilities: { STR: 3 },
      proficiencies: { martial: true },
      proficiencyBonus: 2,
      twoHanded: true,
      advantage: true,
      targetAC: 10,
      seed: 'e2e-seed',
    });

    expect(result.attack.expression).toBe('1d20+5 adv vs AC 10');
    expect(result.attack.d20s.length).toBe(2);
    expect(result.attack.natural).toBe(Math.max(...result.attack.d20s));
    expect(result.attack.total).toBe(result.attack.natural + 5);
    const expectedHit =
      !result.attack.isFumble && (result.attack.isCrit || result.attack.total >= 10);
    expect(result.attack.hit).toBe(expectedHit);
    expect(result.attack.d20s).toEqual(repeat.attack.d20s);

    expect(result.damage?.expression).toBe('1d10+3');
    expect(result.damage?.rolls.length).toBe(1);
    const baseRoll = result.damage?.rolls[0] ?? 0;
    expect(result.damage?.baseTotal).toBe(baseRoll + 3);
    expect(result.damage?.finalTotal).toBe(result.damage?.baseTotal);
    expect(result.damage?.rolls).toEqual(repeat.damage?.rolls ?? []);
  });
});
