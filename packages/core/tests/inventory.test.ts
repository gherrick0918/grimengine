import { describe, expect, it } from 'vitest';
import { createEncounter } from '../src/encounter.js';
import {
  giveToActor,
  giveToParty,
  listBag,
  listInv,
  takeFromActor,
  takeFromParty,
} from '../src/inventory.js';

describe('inventory helpers', () => {
  it('merges quantities and removes entries when totals drop to zero', () => {
    const encounter = createEncounter('inventory-test');

    giveToParty(encounter, 'Copper coins', 10);
    giveToParty(encounter, 'Copper Coins', 5);

    expect(listBag(encounter)).toEqual([{ name: 'Copper coins', qty: 15 }]);

    const taken = takeFromParty(encounter, 'Copper COINS', 12);
    expect(taken).toBe(12);
    expect(listBag(encounter)).toEqual([{ name: 'Copper coins', qty: 3 }]);

    const removed = takeFromParty(encounter, 'Copper Coins', 3);
    expect(removed).toBe(3);
    expect(listBag(encounter)).toEqual([]);
  });

  it('tracks party and actor inventories separately and snapshot-friendly', () => {
    const encounter = createEncounter('inventory-actors');

    giveToParty(encounter, 'Potion', 2);
    giveToActor(encounter, 'actor-1', 'Arrows', 5);
    giveToActor(encounter, 'actor-1', 'Arrows', 1);

    const taken = takeFromActor(encounter, 'actor-1', 'Arrows', 3);
    expect(taken).toBe(3);

    const bagItems = listBag(encounter);
    const actorItems = listInv(encounter, 'actor-1');

    expect(bagItems).toEqual([{ name: 'Potion', qty: 2 }]);
    expect(actorItems).toEqual([{ name: 'Arrows', qty: 3 }]);

    const snapshot = JSON.parse(
      JSON.stringify({ partyBag: encounter.partyBag, inventories: encounter.inventories }),
    );
    expect(snapshot).toEqual({
      partyBag: [{ name: 'Potion', qty: 2 }],
      inventories: { 'actor-1': [{ name: 'Arrows', qty: 3 }] },
    });
  });
});
