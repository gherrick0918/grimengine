import { describe, expect, it } from 'vitest';
import { roll } from '../src/dice.js';
import { rollLoot, type LootTable } from '../src/loot.js';

function createSequenceRng(values: number[]): () => number {
  let index = 0;
  return () => {
    const value = values[index] ?? values[values.length - 1] ?? 0;
    index += 1;
    return value;
  };
}

function createDeterministicRng(seed: number): () => number {
  let state = seed % 2147483647;
  if (state <= 0) {
    state += 2147483646;
  }
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
}

describe('rollLoot', () => {
  it('resolves dice quantities using the provided seed', () => {
    const table: LootTable = {
      name: 'dice-test',
      entries: [
        { weight: 1, item: { name: 'Arrows', qty: { dice: '2d6+1' } } },
      ],
    };

    const results = rollLoot(table, { random: () => 0.1, seed: 'loot-seed' });
    expect(results).toHaveLength(1);
    const item = results[0]!;
    expect(item.kind).toBe('item');
    const expectedQty = roll('2d6+1', { seed: 'loot-seed:roll0' }).total;
    expect(item.qty).toBe(expectedQty);
  });

  it('respects entry weights across many rolls', () => {
    const table: LootTable = {
      name: 'weight-test',
      entries: [
        { weight: 1, item: { name: 'Arrow' } },
        { weight: 3, item: { name: 'Potion' } },
      ],
    };

    const rng = createDeterministicRng(12345);
    let arrow = 0;
    let potion = 0;

    for (let i = 0; i < 2000; i += 1) {
      const [result] = rollLoot(table, { random: rng });
      if (!result) {
        continue;
      }
      if (result.kind === 'item' && result.name === 'Arrow') {
        arrow += 1;
      } else if (result.kind === 'item' && result.name === 'Potion') {
        potion += 1;
      }
    }

    const total = arrow + potion;
    expect(total).toBeGreaterThan(0);
    const potionRatio = potion / total;
    expect(potionRatio).toBeGreaterThan(0.7);
    expect(potionRatio).toBeLessThan(0.8);
  });

  it('returns coin entries when requested', () => {
    const table: LootTable = {
      name: 'coin-test',
      entries: [
        { weight: 1, item: { type: 'coins', denom: 'Gold', qty: 3 } },
      ],
    };

    const [result] = rollLoot(table, { random: () => 0.25 });
    expect(result).toEqual({ kind: 'coins', denom: 'Gold', qty: 3 });
  });

  it('skips entries with non-positive quantities', () => {
    const table: LootTable = {
      name: 'skip-test',
      rolls: 2,
      entries: [
        { weight: 1, item: { name: 'Broken Arrow', qty: 0 } },
        { weight: 1, item: { name: 'Arrow' } },
      ],
    };

    const rng = createSequenceRng([0.1, 0.6]);
    const results = rollLoot(table, { random: rng });
    expect(results).toEqual([{ kind: 'item', name: 'Arrow', qty: 1 }]);
  });
});
