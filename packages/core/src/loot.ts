import { roll } from './dice.js';

/** Minimal CR→XP (5e SRD/DMG values, subset sufficient for testing) */
export const CR_XP: Record<string, number> = {
  '0': 10,
  '1/8': 25,
  '1/4': 50,
  '1/2': 100,
  '1': 200,
  '2': 450,
  '3': 700,
  '4': 1100,
  '5': 1800,
  '6': 2300,
  '7': 2900,
  '8': 3900,
  '9': 5000,
  '10': 5900,
  // extend later as needed
};

export type CoinBundle = { cp: number; sp: number; gp: number; pp: number };
export type LootRoll = { coins: CoinBundle; items: string[] };

export const LOOT_COIN_DENOMINATIONS = ['Copper', 'Silver', 'Electrum', 'Gold', 'Platinum'] as const;
export type LootCoinDenomination = (typeof LOOT_COIN_DENOMINATIONS)[number];

export type LootQty = number | { dice: string };

export interface LootItemSpec {
  type?: 'coins';
  denom?: LootCoinDenomination;
  name?: string;
  qty?: LootQty;
}

export interface LootEntry {
  item: LootItemSpec;
  weight: number;
}

export interface LootTable {
  name: string;
  rolls?: number;
  entries: LootEntry[];
}

export type RolledLootItem =
  | { kind: 'coins'; denom: LootCoinDenomination; qty: number }
  | { kind: 'item'; name: string; qty: number };

export interface RollLootOptions {
  random?: () => number;
  seed?: string;
}

function normalizedRandom(random: () => number): number {
  const value = random();
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value <= 0) {
    return 0;
  }
  if (value >= 1) {
    return 1 - Number.EPSILON;
  }
  return value;
}

function resolveQty(spec: LootQty | undefined, rollIndex: number, opts: RollLootOptions): number {
  if (spec === undefined) {
    return 1;
  }
  if (typeof spec === 'number') {
    return spec;
  }
  const expr = spec.dice.trim();
  if (!expr) {
    return 0;
  }
  const seed = opts.seed ? `${opts.seed}:roll${rollIndex}` : undefined;
  return roll(expr, seed ? { seed } : undefined).total;
}

function normalizeRollCount(value: number | undefined): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 1;
  }
  const normalized = Math.floor(numeric);
  return normalized > 0 ? normalized : 1;
}

function normalizeWeight(weight: number | undefined): number {
  const numeric = Number(weight);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return numeric > 0 ? numeric : 0;
}

function makeItemKey(item: LootItemSpec): string | undefined {
  if (item.type === 'coins') {
    return item.denom ? `coins:${item.denom}` : undefined;
  }
  if (item.name) {
    return `item:${item.name.trim().toLowerCase()}`;
  }
  return undefined;
}

export function rollLoot(table: LootTable, options: RollLootOptions = {}): RolledLootItem[] {
  const rng = options.random ?? Math.random;
  const entries = table.entries
    .map((entry) => ({ entry, weight: normalizeWeight(entry.weight) }))
    .filter((candidate) => candidate.weight > 0 && makeItemKey(candidate.entry.item));

  if (entries.length === 0) {
    return [];
  }

  const totalWeight = entries.reduce((sum, candidate) => sum + candidate.weight, 0);
  if (totalWeight <= 0) {
    return [];
  }

  const rolls = normalizeRollCount(table.rolls);
  const results: RolledLootItem[] = [];

  for (let i = 0; i < rolls; i += 1) {
    const sample = normalizedRandom(rng) * totalWeight;
    let accumulated = 0;
    let selected = entries[entries.length - 1]!;
    for (const candidate of entries) {
      accumulated += candidate.weight;
      if (sample < accumulated) {
        selected = candidate;
        break;
      }
    }

    const qtyRaw = resolveQty(selected.entry.item.qty, i, options);
    const qty = Math.trunc(qtyRaw);
    if (qty <= 0) {
      continue;
    }

    const item = selected.entry.item;
    if (item.type === 'coins') {
      if (!item.denom) {
        continue;
      }
      results.push({ kind: 'coins', denom: item.denom, qty });
    } else if (item.name) {
      results.push({ kind: 'item', name: item.name, qty });
    }
  }

  return results;
}

/** CR→coin dice expressions (very simple stub; expandable) */
const CR_COIN_EXPR: Record<string, Partial<Record<keyof CoinBundle, string>>> = {
  '0': { cp: '1d6x5' },
  '1/8': { cp: '1d6x10' },
  '1/4': { sp: '1d6x5' },
  '1/2': { sp: '1d6x10' },
  '1': { gp: '2d6x10' },
  '2': { gp: '4d6x10' },
  '3': { gp: '5d6x10' },
  '4': { gp: '6d6x10' },
  '5': { gp: '8d6x10', pp: '1d6x1' },
  '6': { gp: '10d6x10', pp: '1d6x2' },
  '7': { gp: '12d6x10', pp: '2d6x2' },
  '8': { gp: '15d6x10', pp: '2d6x5' },
  '9': { gp: '18d6x10', pp: '2d6x10' },
  '10': { gp: '20d6x10', pp: '3d6x10' },
};

/** parse "NdM x K" mini-notation; supports "2d6x10" and "1d6" (K=1) */
function rollCoins(expr?: string, seed?: string): number {
  if (!expr) return 0;
  const m = expr.match(/^(\d+)d(\d+)(?:x(\d+))?$/i);
  if (!m) return 0;
  const n = Number(m[1]);
  const faces = Number(m[2]);
  const mult = Number(m[3] ?? 1);
  let sum = 0;
  for (let i = 0; i < n; i += 1) {
    const rollSeed = seed ? `${seed}:${i}` : undefined;
    sum += roll(`1d${faces}`, { seed: rollSeed }).total;
  }
  return sum * mult;
}

/** Roll a coin bundle for a given CR string; unknown CRs yield zeros. */
export function rollCoinsForCR(cr: string, seed?: string): CoinBundle {
  const map = CR_COIN_EXPR[cr] || {};
  return {
    cp: rollCoins(map.cp, seed ? `${seed}:cp` : undefined),
    sp: rollCoins(map.sp, seed ? `${seed}:sp` : undefined),
    gp: rollCoins(map.gp, seed ? `${seed}:gp` : undefined),
    pp: rollCoins(map.pp, seed ? `${seed}:pp` : undefined),
  };
}

/** Compute XP for a monster CR string. Unknown CRs return 0. */
export function xpForCR(cr: string): number {
  return CR_XP[cr] ?? 0;
}

/** Sum XP for an array of CRs. */
export function totalXP(crs: string[]): number {
  return crs.reduce((sum, current) => sum + xpForCR(current), 0);
}
