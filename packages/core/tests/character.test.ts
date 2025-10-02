import { afterEach, describe, expect, it } from 'vitest';

import {
  abilityMod,
  proficiencyBonusForLevel,
  characterSavingThrow,
  characterWeaponAttack,
  setCharacterWeaponLookup,
  type Character,
} from '../src/character.js';
import type { Weapon } from '../src/weapons.js';

const LONGSWORD: Weapon = {
  name: 'Longsword',
  category: 'martial',
  type: 'melee',
  damage: { expression: '1d8+0', type: 'slashing' },
  versatile: { expression: '1d10+0' },
};

const RAPIER: Weapon = {
  name: 'Rapier',
  category: 'martial',
  type: 'melee',
  damage: { expression: '1d8+0', type: 'piercing' },
  properties: { finesse: true },
};

const LONG_BOW: Weapon = {
  name: 'Longbow',
  category: 'martial',
  type: 'ranged',
  damage: { expression: '1d8+0', type: 'piercing' },
  properties: { ammunition: true, heavy: true, twoHanded: true },
  range: { normal: 150, long: 600 },
};

afterEach(() => {
  setCharacterWeaponLookup(undefined);
});

describe('abilityMod', () => {
  it('matches expected values for common ability scores', () => {
    expect(abilityMod(8)).toBe(-1);
    expect(abilityMod(10)).toBe(0);
    expect(abilityMod(14)).toBe(2);
    expect(abilityMod(18)).toBe(4);
  });
});

describe('proficiencyBonusForLevel', () => {
  it('returns the correct bonus across the level table', () => {
    expect(proficiencyBonusForLevel(1)).toBe(2);
    expect(proficiencyBonusForLevel(5)).toBe(3);
    expect(proficiencyBonusForLevel(9)).toBe(4);
    expect(proficiencyBonusForLevel(13)).toBe(5);
    expect(proficiencyBonusForLevel(17)).toBe(6);
    expect(proficiencyBonusForLevel(20)).toBe(6);
  });
});

describe('characterSavingThrow', () => {
  const baseCharacter: Character = {
    name: 'Aerin',
    level: 5,
    abilities: {
      STR: 16,
      DEX: 12,
      CON: 14,
      INT: 10,
      WIS: 10,
      CHA: 8,
    },
    proficiencies: {
      saves: ['STR', 'CON'],
    },
  };

  it('adds proficiency bonus for proficient saves', () => {
    const proficient = characterSavingThrow(baseCharacter, 'STR', {
      dc: 12,
      seed: 'save-prof',
    });

    const notProficient = characterSavingThrow(
      { ...baseCharacter, proficiencies: { saves: [] } },
      'STR',
      { dc: 12, seed: 'save-prof' },
    );

    expect(proficient.total).toBe(notProficient.total + proficiencyBonusForLevel(baseCharacter.level));
    expect(proficient.expression).toBe('1d20+3+3 vs DC 12');
    expect(notProficient.expression).toBe('1d20+3 vs DC 12');
  });
});

describe('characterWeaponAttack', () => {
  function registerWeapons(): void {
    setCharacterWeaponLookup((name) => {
      const lower = name.toLowerCase();
      if (lower === 'longsword') return LONGSWORD;
      if (lower === 'rapier') return RAPIER;
      if (lower === 'longbow') return LONG_BOW;
      return undefined;
    });
  }

  it('applies proficiency bonus when the character is proficient', () => {
    registerWeapons();
    const character: Character = {
      name: 'Warrior',
      level: 1,
      abilities: {
        STR: 16,
        DEX: 12,
        CON: 12,
        INT: 10,
        WIS: 10,
        CHA: 8,
      },
      proficiencies: {
        weapons: { martial: true },
      },
    };

    const result = characterWeaponAttack(character, 'Longsword', { seed: 'longsword-prof' });
    expect(result.attack.expression).toBe('1d20+5');
    expect(result.damage?.expression).toBe('1d8+3');
  });

  it('prefers dexterity for finesse or ranged weapons when higher', () => {
    registerWeapons();
    const character: Character = {
      name: 'Scout',
      level: 1,
      abilities: {
        STR: 10,
        DEX: 16,
        CON: 12,
        INT: 10,
        WIS: 12,
        CHA: 8,
      },
      proficiencies: {
        weapons: { martial: true },
      },
    };

    const rapier = characterWeaponAttack(character, 'Rapier', { seed: 'rapier-dex' });
    expect(rapier.attack.expression).toBe('1d20+5');

    const bow = characterWeaponAttack(character, 'Longbow', { seed: 'longbow-dex' });
    expect(bow.attack.expression).toBe('1d20+5');
  });

  it('uses versatile damage when attacking two-handed', () => {
    registerWeapons();
    const character: Character = {
      name: 'Fighter',
      level: 1,
      abilities: {
        STR: 16,
        DEX: 12,
        CON: 12,
        INT: 10,
        WIS: 10,
        CHA: 10,
      },
      proficiencies: {
        weapons: { martial: true },
      },
    };

    const result = characterWeaponAttack(character, 'Longsword', {
      twoHanded: true,
      seed: 'versatile-character',
    });

    expect(result.damage?.expression).toBe('1d10+3');
  });
});
