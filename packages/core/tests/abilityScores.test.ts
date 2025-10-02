import { describe, expect, it } from 'vitest';

import {
  roll4d6DropLowest,
  rollAbilityScores,
  standardArray,
  calculatePointBuyCost,
  validatePointBuy,
} from '../src/abilityScores.js';

describe('ability scores', () => {
  it('roll4d6DropLowest returns four rolls and sum of top dice', () => {
    const mockRolls = [0.99, 0.2, 0.75, 0.35];
    let index = 0;
    const rng = () => mockRolls[index++];
    const result = roll4d6DropLowest(rng, 1);
    expect(result.rolls).toEqual([6, 2, 5, 3]);
    expect(result.total).toBe(6 + 5 + 3);
  });

  it('rollAbilityScores with seed is deterministic', () => {
    const first = rollAbilityScores({ seed: 'x' });
    const second = rollAbilityScores({ seed: 'x' });
    expect(first.sets).toEqual(second.sets);
    expect(first.sets).toHaveLength(6);
  });

  it('rollAbilityScores respects sorting options', () => {
    const base = rollAbilityScores({ seed: 'sort-test' });
    const asc = rollAbilityScores({ seed: 'sort-test', sort: 'asc' });
    const desc = rollAbilityScores({ seed: 'sort-test', sort: 'desc' });

    const ascending = [...base.sets].sort((a, b) => a - b);
    const descending = [...ascending].reverse();

    expect(asc.sets).toEqual(ascending);
    expect(desc.sets).toEqual(descending);
  });

  it('standardArray returns the expected numbers', () => {
    expect(standardArray()).toEqual([15, 14, 13, 12, 10, 8]);
  });

  it('calculatePointBuyCost computes PHB total', () => {
    expect(calculatePointBuyCost([15, 14, 13, 12, 10, 8])).toBe(27);
  });

  describe('validatePointBuy', () => {
    it('accepts standard array', () => {
      const result = validatePointBuy([15, 14, 13, 12, 10, 8]);
      expect(result.ok).toBe(true);
      expect(result.cost).toBe(27);
    });

    it('rejects values out of bounds', () => {
      const result = validatePointBuy([16, 7, 10, 10, 10, 10]);
      expect(result.ok).toBe(false);
      expect(result.errors).toEqual([
        'Value 16 exceeds maximum 15',
        'Value 7 is below minimum 8',
      ]);
    });

    it('reports when total cost exceeds the budget', () => {
      const result = validatePointBuy([15, 15, 15, 15, 15, 15], { budget: 40 });
      expect(result.ok).toBe(false);
      expect(result.errors).toEqual(['Total cost 54 exceeds budget 40']);
    });

    it('reports incorrect count', () => {
      const result = validatePointBuy([15, 14, 13, 12, 10]);
      expect(result.ok).toBe(false);
      expect(result.errors).toContain('Expected 6 ability scores, received 5');
    });
  });
});
