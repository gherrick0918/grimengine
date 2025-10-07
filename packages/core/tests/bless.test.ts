import { describe, expect, it } from 'vitest';
import {
  addActor,
  createEncounter,
  type EncounterState,
  type MonsterActor,
  type PlayerActor,
} from '../src/encounter.js';
import { startBless, endBless } from '../src/spells/bless.js';

function createPc(id: string, name: string): PlayerActor {
  return {
    id,
    name,
    type: 'pc',
    side: 'party',
    ac: 15,
    hp: 22,
    maxHp: 22,
    abilityMods: { WIS: 3, CHA: 2 },
    proficiencyBonus: 2,
  };
}

function createMonster(id: string, name: string): MonsterActor {
  return {
    id,
    name,
    type: 'monster',
    side: 'foe',
    ac: 12,
    hp: 11,
    maxHp: 11,
    abilityMods: { DEX: 1 },
    proficiencyBonus: 2,
    attacks: [
      {
        name: 'Scimitar',
        attackMod: 3,
        damageExpr: '1d6+1',
      },
    ],
  };
}

function setupEncounter(): EncounterState {
  let encounter = createEncounter('bless-test');
  encounter = addActor(encounter, createPc('pc-1', 'Bruni'));
  encounter = addActor(encounter, createPc('pc-2', 'Kara'));
  encounter = addActor(encounter, createMonster('m-1', 'Goblin'));
  encounter = addActor(encounter, createMonster('m-2', 'Wolf'));
  return encounter;
}

describe('Bless helper', () => {
  it('starts concentration, applies tags, and caps to three unique targets', () => {
    const base = setupEncounter();

    const next = startBless(base, 'pc-1', ['pc-1', 'pc-2', 'm-1', 'm-2', 'pc-2']);

    expect(next.concentration?.['pc-1']).toEqual({
      casterId: 'pc-1',
      spellName: 'Bless',
      targetIds: ['pc-1', 'pc-2', 'm-1'],
    });

    const casterTags = next.actors['pc-1']?.tags ?? [];
    const karaTags = next.actors['pc-2']?.tags ?? [];
    const goblinTags = next.actors['m-1']?.tags ?? [];
    const wolfTags = next.actors['m-2']?.tags ?? [];

    expect(casterTags).toHaveLength(1);
    expect(karaTags).toHaveLength(1);
    expect(goblinTags).toHaveLength(1);
    expect(wolfTags).toHaveLength(0);

    for (const tag of [...casterTags, ...karaTags, ...goblinTags]) {
      expect(tag).toMatchObject({
        text: 'Bless',
        key: 'spell:bless',
        value: true,
        note: 'Add 1d4 to attack rolls and saving throws',
        source: 'conc:pc-1:bless',
      });
    }
  });

  it('reapplies by clearing previous Bless tags before retargeting', () => {
    const base = setupEncounter();
    const first = startBless(base, 'pc-1', ['pc-2', 'm-1']);
    const second = startBless(first, 'pc-1', ['pc-1', 'm-2']);

    expect(second.concentration?.['pc-1']).toEqual({
      casterId: 'pc-1',
      spellName: 'Bless',
      targetIds: ['pc-1', 'm-2'],
    });

    expect(second.actors['pc-2']?.tags).toEqual([]);
    expect(second.actors['m-1']?.tags).toEqual([]);

    const casterTags = second.actors['pc-1']?.tags ?? [];
    const wolfTags = second.actors['m-2']?.tags ?? [];

    expect(casterTags).toHaveLength(1);
    expect(wolfTags).toHaveLength(1);
    expect(casterTags[0]?.source).toBe('conc:pc-1:bless');
    expect(wolfTags[0]?.source).toBe('conc:pc-1:bless');
  });

  it('ends Bless by removing concentration and tags', () => {
    const base = setupEncounter();
    const started = startBless(base, 'pc-1', ['pc-2', 'm-1']);
    const ended = endBless(started, 'pc-1');

    expect(ended.concentration?.['pc-1']).toBeUndefined();
    expect(ended.actors['pc-2']?.tags).toEqual([]);
    expect(ended.actors['m-1']?.tags).toEqual([]);
  });
});
