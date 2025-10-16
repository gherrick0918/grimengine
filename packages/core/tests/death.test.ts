import { describe, expect, it } from 'vitest';
import {
  applyDamage,
  applyHealing,
  getDeath,
  rollDeathSave,
} from '../src/death.js';

describe('death state helpers', () => {
  it('applies damage and marks actor as dying', () => {
    const actor = { name: 'Goblin', hp: 5, maxHp: 5 };
    applyDamage(actor, 10);
    expect(actor.hp).toBe(0);
    const death = getDeath(actor);
    expect(death.stable).toBe(false);
    expect(death.successes).toBe(0);
    expect(death.failures).toBe(0);
  });

  it('clears death state when healing restores hit points', () => {
    const actor = { name: 'Hero', hp: { max: 12, current: 0 }, maxHp: 12 };
    const death = getDeath(actor);
    death.failures = 2;
    death.stable = true;

    applyHealing(actor, 5);

    expect(actor.hp).toEqual({ max: 12, current: 5 });
    expect(actor.death).toEqual({ successes: 0, failures: 0, stable: false, dead: false });
  });

  it('counts a natural 1 as two failures', () => {
    const actor = { name: 'Lena', hp: { max: 10, current: 0 }, maxHp: 10 };
    const result = rollDeathSave(actor, 1);
    expect(result.line).toContain('Failure');
    expect(actor.death?.failures).toBe(2);
    expect(actor.death?.successes).toBe(0);
  });

  it('restores 1 HP on a natural 20 and clears death state', () => {
    const actor = { name: 'Lena', hp: { max: 10, current: 0 }, maxHp: 10 };
    const result = rollDeathSave(actor, 20);
    expect(result.line).toContain('regains 1 HP');
    expect(actor.hp).toEqual({ max: 10, current: 1 });
    expect(actor.death).toEqual({ successes: 0, failures: 0, stable: false, dead: false });
  });

  it('stabilizes after three successes', () => {
    const actor = { name: 'Lena', hp: { max: 10, current: 0 }, maxHp: 10 };
    rollDeathSave(actor, 12);
    rollDeathSave(actor, 15);
    const result = rollDeathSave(actor, 18);
    expect(result.line).toContain('is stable');
    expect(actor.death?.stable).toBe(true);
    expect(actor.death?.successes).toBe(3);
    expect(actor.death?.failures).toBe(0);
  });

  it('marks actor dead after three failures', () => {
    const actor = { name: 'Lena', hp: { max: 10, current: 0 }, maxHp: 10 };
    rollDeathSave(actor, 5);
    rollDeathSave(actor, 7);
    const result = rollDeathSave(actor, 3);
    expect(result.line).toContain('has died');
    expect(actor.death?.dead).toBe(true);
    expect(actor.death?.failures).toBe(3);
  });
});
