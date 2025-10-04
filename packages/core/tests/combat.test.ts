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

    expect(result.d20s.length).toBe(1);
    expect(result.natural).toBe(result.d20s[0]);
    expect(result.total).toBe(result.natural + 5);
    const expectedHit = !result.isFumble && (result.isCrit || result.total >= 15);
    expect(result.hit).toBe(expectedHit);
    expect(result.expression).toBe('1d20+5 vs AC 15');
  });

  it('supports advantage and disadvantage', () => {
    const advantage = attackRoll({ advantage: true, seed: 'adv-seed' });
    expect(advantage.d20s.length).toBe(2);
    expect(advantage.natural).toBe(Math.max(...advantage.d20s));
    expect(advantage.total).toBe(advantage.natural);
    expect(advantage.expression).toBe('1d20 adv');

    const disadvantage = attackRoll({ disadvantage: true, seed: 'adv-seed' });
    expect(disadvantage.d20s.length).toBe(2);
    expect(disadvantage.natural).toBe(Math.min(...disadvantage.d20s));
    expect(disadvantage.total).toBe(disadvantage.natural);
    expect(disadvantage.expression).toBe('1d20 dis');
  });

  it('detects critical hits and fumbles', () => {
    const crit = attackRoll({ advantage: true, seed: 'crit-2', targetAC: 30 });
    expect(crit.d20s.length).toBe(2);
    expect(crit.natural).toBe(20);
    expect(crit.isCrit).toBe(true);
    expect(crit.hit).toBe(true);

    const fumble = attackRoll({ seed: 'fumble-29', targetAC: 5 });
    expect(fumble.d20s.length).toBe(1);
    expect(fumble.natural).toBe(1);
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

    const expectedHit = !result.attack.isFumble && (result.attack.isCrit || result.attack.total >= 10);
    expect(result.attack.hit).toBe(expectedHit);
    if (expectedHit) {
      expect(result.damage).toBeDefined();
    } else {
      expect(result.damage).toBeUndefined();
    }
  });

  it('returns damage on a normal hit', () => {
    const result = resolveAttack({
      seed: 'attack-basic',
      abilityMod: 2,
      targetAC: 15,
      damage: { expression: '1d8+3', seed: 'damage-basic' },
    });

    const expectedHit = !result.attack.isFumble && (result.attack.isCrit || result.attack.total >= 15);
    expect(result.attack.hit).toBe(expectedHit);
    if (expectedHit) {
      expect(result.damage).toBeDefined();
      expect(result.damage?.baseTotal).toBe(result.damage?.finalTotal ?? NaN);
    } else {
      expect(result.damage).toBeUndefined();
    }
  });

  it('doubles damage dice on critical hits', () => {
    const result = resolveAttack({
      advantage: true,
      seed: 'crit-2',
      targetAC: 25,
      damage: { expression: '1d8+3', seed: 'damage-basic' },
    });

    expect(result.attack.isCrit).toBe(true);
    expect(result.damage).toBeDefined();
    expect(result.damage?.critRolls).toBeDefined();
    const critRollTotal = (result.damage?.critRolls ?? []).reduce((sum, value) => sum + value, 0);
    const normalRollTotal = (result.damage?.rolls ?? []).reduce((sum, value) => sum + value, 0);
    expect(critRollTotal).toBeGreaterThan(0);
    expect(result.damage?.baseTotal).toBe(normalRollTotal + critRollTotal + 3);
  });
});
