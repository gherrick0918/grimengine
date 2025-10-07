import { describe, expect, it } from 'vitest';
import {
  addActor,
  createEncounter,
  type EncounterState,
  type MonsterActor,
  type PlayerActor,
} from '../src/encounter.js';
import { startHuntersMark, endHuntersMark } from '../src/spells/huntersMark.js';

function createPc(id: string, name: string): PlayerActor {
  return {
    id,
    name,
    type: 'pc',
    side: 'party',
    ac: 15,
    hp: 20,
    maxHp: 20,
    abilityMods: { DEX: 3, WIS: 2 },
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
  let encounter = createEncounter('hm-test');
  encounter = addActor(encounter, createPc('pc-1', 'Kara')); 
  encounter = addActor(encounter, createMonster('m-1', 'Goblin'));
  encounter = addActor(encounter, createMonster('m-2', 'Wolf'));
  return encounter;
}

describe("Hunter's Mark helper", () => {
  it('starts concentration and tags the selected target', () => {
    const base = setupEncounter();

    const next = startHuntersMark(base, 'pc-1', 'm-1');
    const entry = next.concentration?.['pc-1'];

    expect(entry).toEqual({ casterId: 'pc-1', spellName: "Hunter's Mark", targetId: 'm-1' });

    const targetTags = next.actors['m-1']?.tags ?? [];
    expect(targetTags).toHaveLength(1);
    expect(targetTags[0]).toMatchObject({
      text: "Hunter's Mark",
      key: 'spell:hunters-mark',
      value: true,
      source: 'conc:pc-1:hunters-mark',
      note: 'Add 1d6 to weapon damage rolls against this target',
    });
  });

  it('retargets by clearing prior tags and updating concentration', () => {
    const base = setupEncounter();
    const first = startHuntersMark(base, 'pc-1', 'm-1');
    const second = startHuntersMark(first, 'pc-1', 'm-2');

    expect(second.concentration?.['pc-1']).toEqual({
      casterId: 'pc-1',
      spellName: "Hunter's Mark",
      targetId: 'm-2',
    });

    const firstTargetTags = second.actors['m-1']?.tags ?? [];
    const secondTargetTags = second.actors['m-2']?.tags ?? [];

    expect(firstTargetTags).toHaveLength(0);
    expect(secondTargetTags).toHaveLength(1);
    expect(secondTargetTags[0]?.source).toBe('conc:pc-1:hunters-mark');
  });

  it('removes concentration entry and tags when ending the mark', () => {
    const base = setupEncounter();
    const started = startHuntersMark(base, 'pc-1', 'm-1');
    const ended = endHuntersMark(started, 'pc-1');

    expect(ended.concentration?.['pc-1']).toBeUndefined();
    expect(ended.actors['m-1']?.tags).toEqual([]);
  });

  it('cleans up legacy tag sources when reapplying', () => {
    let encounter = setupEncounter();
    encounter = startHuntersMark(encounter, 'pc-1', 'm-1');

    // Manually rewrite the tag source to match the legacy CLI format.
    const actor = encounter.actors['m-1'];
    if (!actor || !actor.tags) {
      throw new Error('Expected tag on m-1');
    }
    const legacyTag = { ...actor.tags[0], source: "conc:pc-1:Hunter's Mark", key: undefined };
    encounter = {
      ...encounter,
      actors: {
        ...encounter.actors,
        'm-1': { ...actor, tags: [legacyTag] },
      },
    };

    const reapplied = startHuntersMark(encounter, 'pc-1', 'm-2');
    expect(reapplied.actors['m-1']?.tags).toEqual([]);
    const newTargetTags = reapplied.actors['m-2']?.tags ?? [];
    expect(newTargetTags).toHaveLength(1);
    expect(newTargetTags[0]?.source).toBe('conc:pc-1:hunters-mark');
  });
});
