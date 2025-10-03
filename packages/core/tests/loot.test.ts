import { describe, expect, it } from 'vitest';
import { rollCoinsForCR, totalXP, xpForCR } from '../src/loot.js';
import { createEncounter, recordLoot, recordXP, type EncounterState } from '../src/encounter.js';

function createEmptyEncounter(): EncounterState {
  const base = createEncounter('test');
  return { ...base, lootLog: base.lootLog ?? [], xpLog: base.xpLog ?? [] };
}

describe('loot helpers', () => {
  it('maps CR to XP values', () => {
    expect(xpForCR('0')).toBe(10);
    expect(xpForCR('1/2')).toBe(100);
    expect(xpForCR('2')).toBe(450);
    expect(xpForCR('unknown')).toBe(0);
  });

  it('sums XP for multiple CRs', () => {
    expect(totalXP(['1/2', '1', '2'])).toBe(100 + 200 + 450);
  });

  it('rollCoinsForCR returns deterministic values for gp', () => {
    const result = rollCoinsForCR('1', 'loot-seed');
    expect(result.gp).toBeGreaterThan(0);
    expect(result.sp).toBe(0);
    expect(result.cp).toBe(0);
    const repeat = rollCoinsForCR('1', 'loot-seed');
    expect(repeat).toEqual(result);
  });

  it('recordLoot appends entries without mutating previous state', () => {
    const encounter = createEmptyEncounter();
    const first = recordLoot(encounter, {
      coins: { cp: 1, sp: 2, gp: 3, pp: 4 },
      items: ['Sword'],
      note: 'First haul',
    });

    expect(encounter.lootLog).toEqual([]);
    expect(first.lootLog).toEqual([
      { coins: { cp: 1, sp: 2, gp: 3, pp: 4 }, items: ['Sword'], note: 'First haul' },
    ]);

    const second = recordLoot(first, {
      coins: { cp: 0, sp: 5, gp: 0, pp: 0 },
      items: [],
    });

    expect(first.lootLog).toEqual([
      { coins: { cp: 1, sp: 2, gp: 3, pp: 4 }, items: ['Sword'], note: 'First haul' },
    ]);
    expect(second.lootLog).toEqual([
      { coins: { cp: 1, sp: 2, gp: 3, pp: 4 }, items: ['Sword'], note: 'First haul' },
      { coins: { cp: 0, sp: 5, gp: 0, pp: 0 }, items: [], note: undefined },
    ]);
  });

  it('recordXP appends entries without mutating previous state', () => {
    const encounter = createEmptyEncounter();
    const first = recordXP(encounter, { crs: ['1/2'], total: 100 });

    expect(encounter.xpLog).toEqual([]);
    expect(first.xpLog).toEqual([{ crs: ['1/2'], total: 100 }]);

    const second = recordXP(first, { crs: ['1', '2'], total: 650 });

    expect(first.xpLog).toEqual([{ crs: ['1/2'], total: 100 }]);
    expect(second.xpLog).toEqual([
      { crs: ['1/2'], total: 100 },
      { crs: ['1', '2'], total: 650 },
    ]);
  });
});
