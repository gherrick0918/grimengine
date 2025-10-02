import { describe, expect, it } from 'vitest';
import { attackRoll, damageRoll, resolveAttack } from '../src/combat.js';

describe('attackRoll', () => {
  it('applies ability and proficiency modifiers', () => {
    const result = attackRoll({
      abilityMod: 3,
      proficient: true,
      proficiencyBonus: 2,
      seed: 'attack-basic',
      targetAC: 15,
    });

    expect(result.d20s).toEqual([18]);
    expect(result.natural).toBe(18);
    expect(result.total).toBe(23);
    expect(result.hit).toBe(true);
    expect(result.expression).toBe('1d20+5 vs AC 15');
  });

  it('supports advantage and disadvantage', () => {
    const advantage = attackRoll({ advantage: true, seed: 'adv-seed' });
    expect(advantage.d20s).toEqual([20, 13]);
    expect(advantage.natural).toBe(20);
    expect(advantage.total).toBe(20);
    expect(advantage.expression).toBe('1d20 adv');

    const disadvantage = attackRoll({ disadvantage: true, seed: 'adv-seed' });
    expect(disadvantage.d20s).toEqual([20, 13]);
    expect(disadvantage.natural).toBe(13);
    expect(disadvantage.total).toBe(13);
    expect(disadvantage.expression).toBe('1d20 dis');
  });

  it('detects critical hits and fumbles', () => {
    const crit = attackRoll({ advantage: true, seed: 'adv-seed', targetAC: 30 });
    expect(crit.isCrit).toBe(true);
    expect(crit.hit).toBe(true);

    const fumble = attackRoll({ seed: 'seed-1', targetAC: 5 });
    expect(fumble.isFumble).toBe(true);
    expect(fumble.hit).toBe(false);
  });
});

describe('damageRoll', () => {
  it('doubles dice (not modifiers) on critical hits', () => {
    const result = damageRoll({ expression: '1d8+3', crit: true, seed: 'damage-basic' });

    expect(result.rolls).toEqual([3]);
    expect(result.critRolls).toEqual([4]);
    expect(result.baseTotal).toBe(10);
    expect(result.finalTotal).toBe(10);
    expect(result.expression).toBe('1d8+3 (crit)');
  });

  it('applies resistance and vulnerability', () => {
    const resistance = damageRoll({
      expression: '2d6+4',
      resistance: true,
      seed: 'damage-resist',
    });
    expect(resistance.baseTotal).toBe(14);
    expect(resistance.finalTotal).toBe(7);
    expect(resistance.expression).toBe('2d6+4 (resist)');

    const vulnerability = damageRoll({
      expression: '1d10+2',
      vulnerability: true,
      seed: 'damage-vuln',
    });
    expect(vulnerability.baseTotal).toBe(6);
    expect(vulnerability.finalTotal).toBe(12);
    expect(vulnerability.expression).toBe('1d10+2 (vuln)');
  });
});

describe('resolveAttack', () => {
  it('returns attack only when the attack misses', () => {
    const result = resolveAttack({
      seed: 'seed-1',
      targetAC: 10,
      damage: { expression: '1d8+3', seed: 'damage-basic' },
    });

    expect(result.attack.hit).toBe(false);
    expect(result.damage).toBeUndefined();
  });

  it('returns damage on a normal hit', () => {
    const result = resolveAttack({
      seed: 'attack-basic',
      abilityMod: 2,
      targetAC: 15,
      damage: { expression: '1d8+3', seed: 'damage-basic' },
    });

    expect(result.attack.hit).toBe(true);
    expect(result.attack.isCrit).toBe(false);
    expect(result.damage).toBeDefined();
    expect(result.damage?.baseTotal).toBe(6);
    expect(result.damage?.finalTotal).toBe(6);
  });

  it('doubles damage dice on critical hits', () => {
    const result = resolveAttack({
      advantage: true,
      seed: 'adv-seed',
      targetAC: 25,
      damage: { expression: '1d8+3', seed: 'damage-basic' },
    });

    expect(result.attack.isCrit).toBe(true);
    expect(result.damage).toBeDefined();
    expect(result.damage?.critRolls).toEqual([4]);
    expect(result.damage?.baseTotal).toBe(10);
  });
});
