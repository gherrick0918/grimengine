import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  derivedAC,
  derivedMaxHP,
  derivedDefaultWeaponProfile,
  setCharacterArmorData,
  setCharacterWeaponLookup,
  type Character,
} from '../src/character.js';
import type { Weapon } from '../src/weapons.js';

const BASE_CHARACTER: Character = {
  name: 'Hero',
  level: 1,
  abilities: {
    STR: 10,
    DEX: 10,
    CON: 10,
    INT: 10,
    WIS: 10,
    CHA: 10,
  },
};

const ARMOR_FIXTURES = new Map<string, { category: 'light' | 'medium' | 'heavy'; baseAC: number; dexCap?: number }>([
  ['scale mail', { category: 'medium', baseAC: 14, dexCap: 2 }],
  ['plate', { category: 'heavy', baseAC: 18 }],
  ['padded', { category: 'light', baseAC: 11 }],
]);

const WEAPON_FIXTURES = new Map<string, Weapon>([
  [
    'longsword',
    {
      name: 'Longsword',
      category: 'martial',
      type: 'melee',
      damage: { expression: '1d8+0', type: 'slashing' },
      versatile: { expression: '1d10+0' },
    },
  ],
]);

beforeAll(() => {
  setCharacterArmorData((name) => ARMOR_FIXTURES.get(name.toLowerCase()), 2);
  setCharacterWeaponLookup((name) => WEAPON_FIXTURES.get(name.toLowerCase()));
});

afterAll(() => {
  setCharacterArmorData(undefined);
  setCharacterWeaponLookup(undefined);
});

describe('derivedAC', () => {
  it('calculates unarmored AC with and without a shield', () => {
    const character: Character = {
      ...BASE_CHARACTER,
      abilities: { ...BASE_CHARACTER.abilities, DEX: 14 },
    };

    expect(derivedAC(character)).toBe(12);

    const withShield: Character = {
      ...character,
      equipped: { shield: true },
    };

    expect(derivedAC(withShield)).toBe(14);
  });

  it('applies dexterity caps for medium armor and ignores dexterity for heavy armor', () => {
    const medium: Character = {
      ...BASE_CHARACTER,
      abilities: { ...BASE_CHARACTER.abilities, DEX: 16 },
      equipped: { armor: 'Scale Mail' },
    };

    expect(derivedAC(medium)).toBe(16);

    const heavy: Character = {
      ...medium,
      abilities: { ...medium.abilities, DEX: 20 },
      equipped: { armor: 'Plate' },
    };

    expect(derivedAC(heavy)).toBe(18);
  });
});

describe('derivedMaxHP', () => {
  it('uses full hit die at level 1', () => {
    const character: Character = {
      ...BASE_CHARACTER,
      abilities: { ...BASE_CHARACTER.abilities, CON: 14 },
      equipped: { hitDie: 'd10' },
    };

    expect(derivedMaxHP(character)).toBe(12);
  });

  it('adds average hit die and constitution for higher levels', () => {
    const character: Character = {
      ...BASE_CHARACTER,
      level: 3,
      abilities: { ...BASE_CHARACTER.abilities, CON: 14 },
      equipped: { hitDie: 'd10' },
    };

    expect(derivedMaxHP(character)).toBe(28);
  });
});

describe('derivedDefaultWeaponProfile', () => {
  it('derives proficiency bonus and ability modifiers for equipped weapons', () => {
    const character: Character = {
      ...BASE_CHARACTER,
      level: 3,
      abilities: { ...BASE_CHARACTER.abilities, STR: 16 },
      proficiencies: { weapons: { martial: true } },
      equipped: { weapon: 'Longsword' },
    };

    const profile = derivedDefaultWeaponProfile(character);
    expect(profile).not.toBeNull();
    expect(profile?.name).toBe('Longsword');
    expect(profile?.attackMod).toBe(5);
    expect(profile?.damageExpr).toBe('1d8+3');
    expect(profile?.versatileExpr).toBe('1d10+3');
  });

  it('omits proficiency bonus when the character lacks proficiency', () => {
    const character: Character = {
      ...BASE_CHARACTER,
      level: 3,
      abilities: { ...BASE_CHARACTER.abilities, STR: 16 },
      proficiencies: { weapons: { simple: true } },
      equipped: { weapon: 'Longsword' },
    };

    const profile = derivedDefaultWeaponProfile(character);
    expect(profile).not.toBeNull();
    expect(profile?.attackMod).toBe(3);
    expect(profile?.damageExpr).toBe('1d8+3');
  });

  it('returns null when no weapon is equipped', () => {
    const character: Character = {
      ...BASE_CHARACTER,
      level: 3,
    };

    expect(derivedDefaultWeaponProfile(character)).toBeNull();
  });
});
