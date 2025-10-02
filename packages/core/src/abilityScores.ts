import seedrandom from './vendor-seedrandom.js';

export type AbilityName = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';
export type AbilityScores = Record<AbilityName, number>;

export interface AbilityRollOptions {
  seed?: string;
  count?: number;
  drop?: number;
  sort?: 'none' | 'asc' | 'desc';
}

export interface PointBuyOptions {
  budget?: number;
  min?: number;
  max?: number;
}

type AbilityScoreRollResult = {
  total: number;
  rolls: number[];
};

const DEFAULT_COUNT = 6;
const DEFAULT_DROP = 1;
const DEFAULT_SORT: NonNullable<AbilityRollOptions['sort']> = 'none';
const DEFAULT_POINT_BUY_BUDGET = 27;
const DEFAULT_POINT_BUY_MIN = 8;
const DEFAULT_POINT_BUY_MAX = 15;

const POINT_BUY_COST: Record<number, number> = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9,
};

function clampDrop(value: number, sides: number): number {
  if (Number.isNaN(value) || value < 0) {
    return 0;
  }

  if (value >= sides) {
    return sides - 1;
  }

  return Math.floor(value);
}

export function roll4d6DropLowest(
  rng: () => number,
  drop: number = DEFAULT_DROP,
): AbilityScoreRollResult {
  const rolls: number[] = [];
  for (let i = 0; i < 4; i += 1) {
    rolls.push(Math.floor(rng() * 6) + 1);
  }

  const dropCount = clampDrop(drop, rolls.length);
  const sorted = [...rolls].sort((a, b) => a - b);
  const kept = sorted.slice(dropCount);
  const total = kept.reduce((sum, value) => sum + value, 0);

  return { rolls, total };
}

export function rollAbilityScores(opts: AbilityRollOptions = {}): { sets: number[]; details: number[][] } {
  const { seed, count = DEFAULT_COUNT, drop = DEFAULT_DROP, sort = DEFAULT_SORT } = opts;
  const rng = seedrandom(seed);

  const finalCount = Number.isFinite(count) && count > 0 ? Math.floor(count) : DEFAULT_COUNT;
  const finalSort: 'none' | 'asc' | 'desc' = sort === 'asc' || sort === 'desc' ? sort : DEFAULT_SORT;

  const results: AbilityScoreRollResult[] = [];
  for (let i = 0; i < finalCount; i += 1) {
    results.push(roll4d6DropLowest(rng, drop));
  }

  const sortedResults = (() => {
    if (finalSort === 'asc') {
      return [...results].sort((a, b) => a.total - b.total);
    }
    if (finalSort === 'desc') {
      return [...results].sort((a, b) => b.total - a.total);
    }
    return results;
  })();

  return {
    sets: sortedResults.map((result) => result.total),
    details: sortedResults.map((result) => result.rolls),
  };
}

export function standardArray(): number[] {
  return [15, 14, 13, 12, 10, 8];
}

export function calculatePointBuyCost(arr: number[]): number {
  return arr.reduce((sum, value) => {
    const cost = POINT_BUY_COST[value];
    if (typeof cost !== 'number') {
      throw new Error(`Invalid ability score ${value} for point buy`);
    }
    return sum + cost;
  }, 0);
}

export function validatePointBuy(
  arr: number[],
  opts: PointBuyOptions = {},
): { ok: boolean; cost: number; budget: number; errors: string[] } {
  const budget = opts.budget ?? DEFAULT_POINT_BUY_BUDGET;
  const min = opts.min ?? DEFAULT_POINT_BUY_MIN;
  const max = opts.max ?? DEFAULT_POINT_BUY_MAX;

  const errors: string[] = [];
  const values = arr ?? [];

  if (values.length !== DEFAULT_COUNT) {
    errors.push(`Expected 6 ability scores, received ${values.length}`);
  }

  let cost = 0;
  values.forEach((value, index) => {
    if (!Number.isFinite(value)) {
      errors.push(`Value at index ${index} is not a number`);
      return;
    }

    if (!Number.isInteger(value)) {
      errors.push(`Value ${value} must be an integer`);
      return;
    }

    if (value < min) {
      errors.push(`Value ${value} is below minimum ${min}`);
      return;
    }

    if (value > max) {
      errors.push(`Value ${value} exceeds maximum ${max}`);
      return;
    }

    const pointCost = POINT_BUY_COST[value];
    if (typeof pointCost !== 'number') {
      errors.push(`No point-buy cost configured for value ${value}`);
      return;
    }

    cost += pointCost;
  });

  if (cost > budget) {
    errors.push(`Total cost ${cost} exceeds budget ${budget}`);
  }

  return {
    ok: errors.length === 0,
    cost,
    budget,
    errors,
  };
}
