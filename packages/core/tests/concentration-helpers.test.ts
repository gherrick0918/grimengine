import { describe, expect, it } from 'vitest';
import {
  addActor,
  createEncounter,
  getConcentration,
  removeConcentration,
  type EncounterState,
  type PlayerActor,
} from '../src/encounter.js';
import {
  BlessHelper,
  HuntersMarkHelper,
  type DurationSpec,
} from '../src/concentrationHelpers.js';

function createPc(id: string, name: string): PlayerActor {
  return {
    id,
    name,
    side: 'party',
    type: 'pc',
    ac: 15,
    hp: 20,
    maxHp: 20,
    abilityMods: { STR: 3, DEX: 2 },
    proficiencyBonus: 3,
    defaultWeapon: { name: 'Longsword', attackMod: 6, damageExpr: '1d8+4' },
  };
}

function setupEncounter(): EncounterState {
  let encounter = createEncounter('helper-test');
  encounter = addActor(encounter, createPc('pc-1', 'Bruni'));
  encounter = addActor(encounter, createPc('pc-2', 'Aella'));
  encounter = addActor(encounter, createPc('pc-3', 'Thorin'));
  encounter = addActor(encounter, createPc('pc-4', 'Kara'));
  encounter = addActor(encounter, {
    id: 'foe-1',
    name: 'Orc1',
    side: 'foe',
    type: 'monster',
    ac: 13,
    hp: 15,
    maxHp: 15,
    abilityMods: { STR: 3, DEX: 1 },
    attacks: [{ name: 'Greataxe', attackMod: 5, damageExpr: '1d12+3' }],
  });
  encounter = addActor(encounter, {
    id: 'foe-2',
    name: 'Orc2',
    side: 'foe',
    type: 'monster',
    ac: 13,
    hp: 15,
    maxHp: 15,
    abilityMods: { STR: 3, DEX: 1 },
    attacks: [{ name: 'Greataxe', attackMod: 5, damageExpr: '1d12+3' }],
  });
  return encounter;
}

const TEN_ROUNDS: DurationSpec = { rounds: 10, encounterClock: true, label: '10 rounds' };

describe('concentration helpers', () => {
  it('applies bless tags and refreshes on recast', () => {
    let encounter = setupEncounter();
    const helper = new BlessHelper(encounter);

    const cast = helper.cast({
      casterId: 'pc-1',
      targetIds: ['pc-2', 'pc-3', 'pc-4'],
      duration: TEN_ROUNDS,
      breakReason: 'new-cast',
    });
    encounter = cast.state;

    const entry = getConcentration(encounter, 'pc-1');
    expect(entry).toBeDefined();
    expect(entry?.spellId).toBe('bless');
    expect(entry?.targetIds).toEqual(['pc-2', 'pc-3', 'pc-4']);
    expect(encounter.actors['pc-2']?.tags?.some((tag) => tag.text === 'effect:bless')).toBe(true);
    expect(encounter.actors['pc-3']?.tags?.some((tag) => tag.text === 'effect:bless')).toBe(true);
    expect(encounter.actors['pc-4']?.tags?.some((tag) => tag.text === 'effect:bless')).toBe(true);
    expect(encounter.actors['pc-1']?.tags?.some((tag) => tag.text === 'concentration:bless')).toBe(true);

    const refreshed = new BlessHelper(encounter).cast({
      casterId: 'pc-1',
      targetIds: ['pc-2', 'pc-3'],
      duration: { rounds: 5, encounterClock: true, label: '5 rounds' },
      breakReason: 'new-cast',
    });
    encounter = refreshed.state;

    const refreshedEntry = getConcentration(encounter, 'pc-1');
    expect(refreshedEntry?.targetIds).toEqual(['pc-2', 'pc-3']);
    expect(encounter.actors['pc-4']?.tags?.some((tag) => tag.text === 'effect:bless')).toBe(false);
    expect(refreshed.break?.result.entry?.spellId).toBe('bless');
    expect(refreshed.effectTags).toHaveLength(2);
  });

  it("manages hunter's mark cast and transfer", () => {
    let encounter = setupEncounter();

    const hmHelper = new HuntersMarkHelper(encounter);
    const cast = hmHelper.cast({
      casterId: 'pc-1',
      targetId: 'foe-1',
      duration: TEN_ROUNDS,
      breakReason: 'new-cast',
    });
    encounter = cast.state;

    const entry = getConcentration(encounter, 'pc-1');
    expect(entry?.spellId).toBe("hunters-mark");
    expect(entry?.targetId).toBe('foe-1');
    expect(encounter.actors['foe-1']?.tags?.some((tag) => tag.text === 'effect:hunters-mark')).toBe(true);
    expect(encounter.actors['foe-1']?.tags?.some((tag) => tag.text === 'marked-by:pc-1')).toBe(true);

    const transfer = new HuntersMarkHelper(encounter).transfer({ casterId: 'pc-1', targetId: 'foe-2' });
    encounter = transfer.state;

    const updated = getConcentration(encounter, 'pc-1');
    expect(updated?.targetId).toBe('foe-2');
    expect(encounter.actors['foe-1']?.tags?.some((tag) => tag.text.startsWith('effect:hunters-mark'))).toBe(false);
    expect(encounter.actors['foe-2']?.tags?.some((tag) => tag.text === 'effect:hunters-mark')).toBe(true);
    expect(encounter.actors['foe-2']?.tags?.some((tag) => tag.text === 'marked-by:pc-1')).toBe(true);
    expect(transfer.removedTags.length).toBeGreaterThanOrEqual(1);
  });

  it('removeConcentration clears linked tags', () => {
    let encounter = setupEncounter();
    const helper = new HuntersMarkHelper(encounter);
    const cast = helper.cast({ casterId: 'pc-1', targetId: 'foe-1', duration: TEN_ROUNDS });
    encounter = cast.state;
    const removal = removeConcentration(encounter, 'pc-1');
    expect(removal.entry?.spellId).toBe("hunters-mark");
    const state = removal.state;
    expect(state.concentration?.['pc-1']).toBeUndefined();
    expect(state.actors['foe-1']?.tags?.some((tag) => tag.text.startsWith('effect:hunters-mark'))).toBe(false);
    expect(state.actors['pc-1']?.tags?.some((tag) => tag.text.startsWith('concentration:hunters-mark'))).toBe(false);
  });
});
