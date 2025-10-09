import { describe, expect, it } from 'vitest';

import { normalizeCharacter, type Character } from '../src/character.js';

const BASE: Character = {
  name: 'Example',
  level: 3,
  abilities: {
    STR: 10,
    DEX: 12,
    CON: 12,
    INT: 10,
    WIS: 12,
    CHA: 10,
  },
};

describe('normalizeCharacter', () => {
  it('prefers explicit AC and HP values when provided', () => {
    const raw: Character = {
      ...BASE,
      ac: 15,
      hp: { max: 27, current: 18 },
    };

    const normalized = normalizeCharacter(raw);

    expect(normalized.ac).toBe(15);
    expect(normalized.hp?.max).toBe(27);
    expect(normalized.hp?.current).toBe(18);
  });

  it('initializes missing HP fields based on available data', () => {
    const raw: Character = {
      ...BASE,
      hp: { max: 24 },
    };

    const normalized = normalizeCharacter(raw);

    expect(normalized.hp?.max).toBe(24);
    expect(normalized.hp?.current).toBe(24);
    expect(normalized.hp?.temp).toBe(0);
  });

  it('derives sensible fallbacks when values are missing', () => {
    const raw: Character = {
      ...BASE,
      level: 1,
      abilities: {
        ...BASE.abilities,
        DEX: 14,
        WIS: 12,
      },
    };

    const normalized = normalizeCharacter(raw);

    expect(normalized.ac).toBe(12);
    expect(normalized.hp?.max).toBe(8);
    expect(normalized.hp?.current).toBe(8);
    expect(normalized.senses?.passivePerception).toBe(11);
  });
});
