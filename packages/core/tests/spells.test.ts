import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

import {
  castSpell,
  chooseCastingAbility,
  diceForCharacterLevel,
  diceForSlotLevel,
  spellSaveDC,
  type NormalizedSpell,
} from '../src/spells.js';
import { ensureSlots, setSlots, type Character } from '../src/character.js';
import { normalizeSpell } from '../../adapters/dnd5e-api/src/spells.js';

const sacredFlameFixturePath = fileURLToPath(new URL('./fixtures/sacred-flame.api.json', import.meta.url));
const sacredFlameApi = JSON.parse(readFileSync(sacredFlameFixturePath, 'utf8'));

describe('spells', () => {
  test('normalizeSpell maps core mechanics from API data', () => {
    const spell = normalizeSpell(sacredFlameApi);

    expect(spell.name).toBe('Sacred Flame');
    expect(spell.level).toBe(0);
    expect(spell.save).toEqual({ ability: 'DEX', onSuccess: 'none' });
    expect(spell.damageDice).toBe('1d8');
    expect(spell.damageType).toBe('Radiant');
    expect(spell.dcAbility).toBe('WIS');
    expect(spell.info?.range).toBe('60 feet');
    expect(spell.info?.casting_time).toBe('1 action');
    expect(spell.damageAtCharacterLevel?.[1]).toBe('1d8');
    expect(spell.damageAtCharacterLevel?.[5]).toBe('2d8');
    expect(spell.concentration).toBe(false);
  });

  test('diceForCharacterLevel selects highest threshold without exceeding level', () => {
    const spell: NormalizedSpell = {
      name: 'Test Cantrip',
      level: 0,
      damageDice: '1d8',
      damageAtCharacterLevel: {
        1: '1d8',
        5: '2d8',
        11: '3d8',
        17: '4d8',
      },
    };

    expect(diceForCharacterLevel(spell, 1)).toBe('1d8');
    expect(diceForCharacterLevel(spell, 4)).toBe('1d8');
    expect(diceForCharacterLevel(spell, 5)).toBe('2d8');
    expect(diceForCharacterLevel(spell, 13)).toBe('3d8');
    expect(diceForCharacterLevel(spell, 20)).toBe('4d8');
  });

  test('diceForSlotLevel prefers exact slot match', () => {
    const spell: NormalizedSpell = {
      name: 'Scaled Spell',
      level: 1,
      damageDice: '3d6',
      damageAtSlotLevel: {
        1: '3d6',
        2: '4d6',
        3: '5d6',
      },
    };

    expect(diceForSlotLevel(spell, 1)).toBe('3d6');
    expect(diceForSlotLevel(spell, 2)).toBe('4d6');
    expect(diceForSlotLevel(spell, 3)).toBe('5d6');
    expect(diceForSlotLevel(spell, 4)).toBe('3d6');
    expect(diceForSlotLevel(spell, undefined)).toBe('3d6');
  });

  test('spellSaveDC computes 8 + PB + ability modifier', () => {
    const caster: Character = {
      name: 'Cleric',
      level: 5,
      abilities: {
        STR: 10,
        DEX: 12,
        CON: 14,
        INT: 8,
        WIS: 16,
        CHA: 10,
      },
    };

    expect(spellSaveDC(caster, 'WIS')).toBe(8 + 3 + 3);
  });

  test('chooseCastingAbility prefers override or highest modifier', () => {
    const caster: Character = {
      name: 'Wizard',
      level: 3,
      abilities: {
        STR: 8,
        DEX: 14,
        CON: 12,
        INT: 15,
        WIS: 10,
        CHA: 9,
      },
    };

    const spell: NormalizedSpell = { name: 'Test Spell', level: 1 };

    expect(chooseCastingAbility(caster, spell)).toBe('INT');
    expect(chooseCastingAbility(caster, { ...spell, dcAbility: 'WIS' })).toBe('WIS');
    expect(chooseCastingAbility(caster, spell, 'CHA')).toBe('CHA');
  });

  test('castSpell returns save-based result with damage preview', () => {
    const caster: Character = {
      name: 'Cleric',
      level: 5,
      abilities: {
        STR: 10,
        DEX: 12,
        CON: 14,
        INT: 8,
        WIS: 16,
        CHA: 10,
      },
    };

    setSlots(caster, { 1: 2 });

    const spell: NormalizedSpell = {
      name: 'Radiant Burst',
      level: 1,
      save: { ability: 'DEX', onSuccess: 'half' },
      damageDice: '2d6',
      damageType: 'Radiant',
    };

    const result = castSpell({ caster, spell, castingAbility: 'WIS', seed: 'save-seed' });

    expect(result.kind).toBe('save');
    expect(result.save?.dc).toBe(14);
    expect(result.damage?.expression).toBe('2d6+3');
    expect(result.damage?.final).toBeGreaterThanOrEqual(5);
  });

  test('castSpell scales cantrip damage by character level', () => {
    const spell: NormalizedSpell = {
      name: 'Radiant Spark',
      level: 0,
      save: { ability: 'DEX', onSuccess: 'half' },
      damageDice: '1d8',
      damageAtCharacterLevel: {
        1: '1d8',
        5: '2d8',
      },
    };

    const level1Caster: Character = {
      name: 'Novice',
      level: 1,
      abilities: {
        STR: 8,
        DEX: 10,
        CON: 12,
        INT: 10,
        WIS: 16,
        CHA: 10,
      },
    };

    const level5Caster: Character = { ...level1Caster, level: 5 };

    const result1 = castSpell({ caster: level1Caster, spell, castingAbility: 'WIS', seed: 'cantrip-l1' });
    const result5 = castSpell({ caster: level5Caster, spell, castingAbility: 'WIS', seed: 'cantrip-l5' });

    expect(result1.damage?.expression).toBe('1d8+3');
    expect(result5.damage?.expression).toBe('2d8+3');
  });

  test('castSpell scales slot damage when provided', () => {
    const spell: NormalizedSpell = {
      name: 'Guiding Ray',
      level: 1,
      save: { ability: 'DEX', onSuccess: 'half' },
      damageDice: '4d6',
      damageAtSlotLevel: {
        1: '4d6',
        2: '5d6',
        3: '6d6',
      },
    };

    const caster: Character = {
      name: 'Cleric',
      level: 5,
      abilities: {
        STR: 10,
        DEX: 10,
        CON: 12,
        INT: 10,
        WIS: 16,
        CHA: 10,
      },
    };

    setSlots(caster, { 1: 2, 2: 2, 3: 2 });
    ensureSlots(caster);

    const result1 = castSpell({ caster, spell, castingAbility: 'WIS', slotLevel: 1, seed: 'slot-1' });
    const result3 = castSpell({ caster, spell, castingAbility: 'WIS', slotLevel: 3, seed: 'slot-3' });

    expect(result1.damage?.expression).toBe('4d6+3');
    expect(result3.damage?.expression).toBe('6d6+3');
  });

  test('castSpell returns attack result including hit and damage', () => {
    const caster: Character = {
      name: 'Wizard',
      level: 5,
      abilities: {
        STR: 8,
        DEX: 12,
        CON: 12,
        INT: 18,
        WIS: 10,
        CHA: 11,
      },
    };

    const spell: NormalizedSpell = {
      name: 'Arcane Bolt',
      level: 0,
      attackType: 'ranged',
      damageDice: '1d10',
      damageType: 'Force',
    };

    const result = castSpell({ caster, spell, castingAbility: 'INT', targetAC: 13, seed: 'attack-seed' });

    expect(result.kind).toBe('attack');
    expect(result.attack?.expression).toContain('1d20');
    expect(result.attack?.rolls).toHaveLength(1);
    expect(result.attack?.total).toBeGreaterThan(0);
    if (result.damage) {
      expect(result.damage.expression).toContain('1d10');
      expect(result.damage.final).toBeGreaterThanOrEqual(1);
    }
  });
});
