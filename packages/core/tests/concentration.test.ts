import { describe, expect, test } from 'vitest';

import {
  concentrationDCFromDamage,
  createEncounter,
  endConcentration,
  getConcentration,
  startConcentration,
} from '../src/index.js';

describe('concentration helpers', () => {
  test('concentrationDCFromDamage enforces minimum DC 10', () => {
    expect(concentrationDCFromDamage(1)).toBe(10);
    expect(concentrationDCFromDamage(15)).toBe(10);
    expect(concentrationDCFromDamage(22)).toBe(11);
    expect(concentrationDCFromDamage(31)).toBe(15);
  });

  test('startConcentration and endConcentration manage entries', () => {
    const encounter = createEncounter();
    const entry = { casterId: 'pc-1', spellName: 'Bless', targetId: 'ally-1' };

    const withConcentration = startConcentration(encounter, entry);
    expect(getConcentration(withConcentration, 'pc-1')).toEqual(entry);

    const cleared = endConcentration(withConcentration, 'pc-1');
    expect(getConcentration(cleared, 'pc-1')).toBeUndefined();
  });

  test('failed concentration checks can be resolved by clearing the entry', () => {
    const entry = { casterId: 'pc-2', spellName: 'Hold Person' };
    const encounter = startConcentration(createEncounter(), entry);

    const dc = concentrationDCFromDamage(18);
    expect(dc).toBe(10);

    const rollTotal = 7; // simulated failed roll
    expect(rollTotal).toBeLessThan(dc);

    const afterFailure = endConcentration(encounter, entry.casterId);
    expect(getConcentration(afterFailure, entry.casterId)).toBeUndefined();
  });
});
