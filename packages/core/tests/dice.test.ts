import { describe, expect, it } from 'vitest';
import { roll } from '../src/dice.js';

describe('roll', () => {
  it('rolls a single die', () => {
    const result = roll('1d6', { seed: 'simple' });
    expect(result.rolls).toEqual([3]);
    expect(result.total).toBe(3);
    expect(result.expression).toBe('1d6');
  });

  it('applies modifiers', () => {
    const result = roll('2d6+3', { seed: 'mods' });
    expect(result.rolls).toEqual([1, 2]);
    expect(result.total).toBe(6);
    expect(result.expression).toBe('2d6+3');
  });

  it('supports advantage and disadvantage', () => {
    const advantage = roll('1d20+5', { seed: 'hero', advantage: true });
    expect(advantage.rolls).toEqual([7, 12]);
    expect(advantage.total).toBe(17);
    expect(advantage.expression).toBe('1d20+5 adv');

    const disadvantage = roll('1d20+5', { seed: 'hero', disadvantage: true });
    expect(disadvantage.rolls).toEqual([7, 12]);
    expect(disadvantage.total).toBe(12);
    expect(disadvantage.expression).toBe('1d20+5 dis');
  });

  it('produces deterministic results with a seed', () => {
    const first = roll('1d20', { seed: 'repeatable' });
    const second = roll('1d20', { seed: 'repeatable' });
    expect(second).toEqual(first);
  });
});
