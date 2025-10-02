import { describe, expect, it } from 'vitest';
import { abilityCheck, savingThrow } from '../src/checks.js';

describe('abilityCheck', () => {
  it('performs a simple ability check with modifiers', () => {
    const result = abilityCheck({ ability: 'STR', modifier: 3, seed: 'simple' });

    expect(result.rolls).toEqual([8]);
    expect(result.total).toBe(11);
    expect(result.expression).toBe('1d20+3');
    expect(result.success).toBeUndefined();
  });

  it('adds proficiency bonuses when proficient', () => {
    const result = abilityCheck({
      ability: 'DEX',
      modifier: 1,
      proficient: true,
      proficiencyBonus: 2,
      seed: 'prof',
    });

    expect(result.rolls).toEqual([2]);
    expect(result.total).toBe(5);
    expect(result.expression).toBe('1d20+1+2');
  });

  it('supports advantage and disadvantage', () => {
    const advantage = abilityCheck({ ability: 'DEX', advantage: true, seed: 'advantage' });
    expect(advantage.rolls).toEqual([17, 12]);
    expect(advantage.total).toBe(17);
    expect(advantage.expression).toBe('1d20 adv');

    const disadvantage = abilityCheck({ ability: 'DEX', disadvantage: true, seed: 'advantage' });
    expect(disadvantage.rolls).toEqual([17, 12]);
    expect(disadvantage.total).toBe(12);
    expect(disadvantage.expression).toBe('1d20 dis');
  });

  it('evaluates success against a DC', () => {
    const success = abilityCheck({ ability: 'STR', modifier: 1, dc: 15, seed: 'high' });
    expect(success.total).toBe(15);
    expect(success.success).toBe(true);
    expect(success.expression).toBe('1d20+1 vs DC 15');

    const failure = abilityCheck({ ability: 'STR', modifier: 1, dc: 12, seed: 'low' });
    expect(failure.total).toBe(2);
    expect(failure.success).toBe(false);
    expect(failure.expression).toBe('1d20+1 vs DC 12');
  });
});

describe('savingThrow', () => {
  it('shares the same behavior as ability checks', () => {
    const save = savingThrow({ ability: 'CON', modifier: 5, seed: 'high' });

    expect(save.rolls).toEqual([14]);
    expect(save.total).toBe(19);
    expect(save.expression).toBe('1d20+5');
    expect(save.success).toBeUndefined();
  });
});
