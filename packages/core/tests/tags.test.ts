import { describe, expect, it } from 'vitest';
import {
  addActor,
  addActorTag,
  clearActorTags,
  createEncounter,
  nextTurn,
  removeActorTag,
  type EncounterState,
  type PlayerActor,
} from '../src/encounter.js';

function createTestPc(id: string, name: string): PlayerActor {
  return {
    id,
    name,
    side: 'party',
    type: 'pc',
    ac: 15,
    hp: 12,
    maxHp: 12,
    abilityMods: { STR: 2, DEX: 1 },
    proficiencyBonus: 2,
    defaultWeapon: { name: 'Longsword', attackMod: 5, damageExpr: '1d8+3' },
  };
}

function setupEncounter(): EncounterState {
  let encounter = createEncounter('tag-test');
  encounter = addActor(encounter, createTestPc('pc-1', 'Aerin'));
  encounter = addActor(encounter, createTestPc('pc-2', 'Borin'));
  return {
    ...encounter,
    order: [
      { actorId: 'pc-1', rolled: 15, total: 17 },
      { actorId: 'pc-2', rolled: 12, total: 13 },
    ],
    round: 1,
    turnIndex: 0,
  };
}

describe('actor tags', () => {
  it('adds tags with metadata and unique ids', () => {
    const encounter = setupEncounter();
    const baseRound = encounter.round;

    const withFirstTag = addActorTag(encounter, 'pc-1', {
      text: 'Bless',
      expiresAtRound: baseRound + 3,
      note: 'd4 to attacks/saves',
      source: 'Spell: Bless',
    });
    const withSecondTag = addActorTag(withFirstTag, 'pc-1', { text: 'Marked' });

    const tags = withSecondTag.actors['pc-1']?.tags ?? [];
    expect(tags).toHaveLength(2);
    expect(tags.map((tag) => tag.id)).toEqual(['t1', 't2']);
    expect(tags[0]).toMatchObject({
      text: 'Bless',
      expiresAtRound: baseRound + 3,
      note: 'd4 to attacks/saves',
      source: 'Spell: Bless',
      addedAtRound: baseRound,
    });
    expect(tags[1]).toMatchObject({
      text: 'Marked',
      addedAtRound: baseRound,
    });
    expect(tags[1]?.expiresAtRound).toBeUndefined();

    expect(encounter.actors['pc-1']?.tags).toBeUndefined();
  });

  it('expires only the tags whose rounds have passed when advancing turns', () => {
    let encounter = setupEncounter();
    const startRound = encounter.round;
    encounter = addActorTag(encounter, 'pc-1', { text: 'Bless', expiresAtRound: startRound + 1 });
    encounter = addActorTag(encounter, 'pc-2', { text: 'Hunter\'s Mark', expiresAtRound: startRound + 3 });
    encounter = addActorTag(encounter, 'pc-2', { text: 'Taunted' });

    encounter = nextTurn(encounter); // pc-2, round still startRound
    expect(encounter.actors['pc-1']?.tags).toHaveLength(1);

    encounter = nextTurn(encounter); // back to pc-1, round incremented by 1
    expect(encounter.round).toBe(startRound + 1);
    expect(encounter.actors['pc-1']?.tags).toHaveLength(1);

    encounter = nextTurn(encounter); // pc-2, same round
    expect(encounter.actors['pc-1']?.tags).toHaveLength(1);

    encounter = nextTurn(encounter); // back to pc-1, round incremented again
    expect(encounter.round).toBe(startRound + 2);
    expect(encounter.actors['pc-1']?.tags).toEqual([]);

    const pc2Tags = encounter.actors['pc-2']?.tags ?? [];
    expect(pc2Tags.map((tag) => tag.text)).toEqual(["Hunter's Mark", 'Taunted']);
  });

  it('removes and clears tags without mutating previous state', () => {
    const base = setupEncounter();
    const withTag = addActorTag(base, 'pc-1', { text: 'Bless' });
    const addedTag = withTag.actors['pc-1']?.tags?.[0];
    expect(addedTag).toBeDefined();
    expect(base.actors['pc-1']?.tags).toBeUndefined();

    const afterRemoval = removeActorTag(withTag, 'pc-1', addedTag!.id);
    expect(afterRemoval.actors['pc-1']?.tags).toEqual([]);
    expect(withTag.actors['pc-1']?.tags).toHaveLength(1);

    const withMore = addActorTag(withTag, 'pc-1', { text: 'Marked' });
    const cleared = clearActorTags(withMore, 'pc-1');
    expect(cleared.actors['pc-1']?.tags).toEqual([]);
    expect(withMore.actors['pc-1']?.tags).toHaveLength(2);
  });
});
