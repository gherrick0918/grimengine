import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

import { castSpell, chooseCastingAbility, spellSaveDC, type NormalizedSpell } from '../src/spells.js';
import type { Character } from '../src/character.js';
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
