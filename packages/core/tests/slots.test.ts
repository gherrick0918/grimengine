import { describe, expect, it } from 'vitest';

import {
  ensureSlots,
  setSlots,
  spendSlot,
  castSpell,
  type Character,
} from '../src/index.js';
import type { NormalizedSpell } from '@grimengine/dnd5e-api/spells.js';

function createCharacter(): Character {
  return {
    name: 'Tester',
    level: 5,
    abilities: {
      STR: 10,
      DEX: 10,
      CON: 10,
      INT: 10,
      WIS: 10,
      CHA: 10,
    },
  };
}

describe('ensureSlots', () => {
  it('initializes zeroed slot tables when absent', () => {
    const character = createCharacter();
    const slots = ensureSlots(character);

    for (let level = 1; level <= 9; level += 1) {
      expect(slots.max[level]).toBe(0);
      expect(slots.remaining[level]).toBe(0);
    }
  });

  it('mirrors max values into remaining on first setup', () => {
    const character = createCharacter();
    character.slots = { max: { 1: 3 } as Record<number, number> } as any;

    const slots = ensureSlots(character);
    expect(slots.max[1]).toBe(3);
    expect(slots.remaining[1]).toBe(3);
  });
});

describe('setSlots', () => {
  it('updates max slots and clamps remaining when necessary', () => {
    const character = createCharacter();

    setSlots(character, { 1: 4, 2: 2 });
    let slots = ensureSlots(character);
    expect(slots.max[1]).toBe(4);
    expect(slots.remaining[1]).toBe(4);
    expect(slots.max[2]).toBe(2);
    expect(slots.remaining[2]).toBe(2);

    slots.remaining[1] = 3;
    setSlots(character, { 1: 2, 3: 1 });
    slots = ensureSlots(character);
    expect(slots.max[1]).toBe(2);
    expect(slots.remaining[1]).toBe(2);
    expect(slots.max[3]).toBe(1);
    expect(slots.remaining[3]).toBe(1);

    slots.remaining[1] = 2;
    setSlots(character, { 1: 1 });
    slots = ensureSlots(character);
    expect(slots.max[1]).toBe(1);
    expect(slots.remaining[1]).toBe(1);
  });
});

describe('spendSlot', () => {
  it('spends available slots and reports exhaustion', () => {
    const character = createCharacter();
    setSlots(character, { 1: 1 });

    expect(spendSlot(character, 1)).toBe(true);
    let slots = ensureSlots(character);
    expect(slots.remaining[1]).toBe(0);

    expect(spendSlot(character, 1)).toBe(false);
    slots = ensureSlots(character);
    expect(slots.remaining[1]).toBe(0);
  });
});

describe('castSpell slot enforcement', () => {
  it('returns a note when no slot is available for the requested level', () => {
    const character = createCharacter();
    setSlots(character, { 1: 1 });
    const slots = ensureSlots(character);
    slots.remaining[1] = 0;

    const spell: NormalizedSpell = {
      name: 'Test Spell',
      level: 1,
      damageDice: '1d6',
    };

    const result = castSpell({ caster: character, spell, slotLevel: 1 });

    expect(result.kind).toBe('none');
    expect(result.notes).toBeDefined();
    expect(result.notes).toContain('No slot available at level 1.');
  });
});
