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
