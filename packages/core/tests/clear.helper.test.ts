import { describe, expect, it } from 'vitest';
import {
  addActor,
  addActorTag,
  clearStatusEffects,
  createEncounter,
  setCondition,
  startConcentration,
  type EncounterState,
  type PlayerActor,
  type MonsterActor,
} from '../src/encounter.js';

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
  let encounter = createEncounter('clear-helper');
  encounter = addActor(encounter, createPc('pc-1', 'Bruni'));
  encounter = addActor(encounter, createPc('pc-2', 'Kara'));
  encounter = addActor(encounter, createMonster('m-1', 'Goblin #1'));
  return encounter;
}

describe('clearStatusEffects', () => {
  it('removes spell/status tags, conditions, and concentration for selected actors', () => {
    let encounter = setupEncounter();

    encounter = addActorTag(encounter, 'pc-1', { key: 'spell:bless', text: 'Bless' });
    encounter = addActorTag(encounter, 'pc-1', { key: 'note:prep', text: 'Ready' });
    encounter = addActorTag(encounter, 'pc-2', { key: 'spell:guidance', text: 'Guidance' });
    encounter = addActorTag(encounter, 'm-1', { key: 'spell:hunters-mark', text: "Hunter's Mark" });

    encounter = setCondition(encounter, 'pc-1', 'prone');
    encounter = setCondition(encounter, 'pc-2', 'restrained');

    encounter = startConcentration(encounter, {
      casterId: 'pc-1',
      spellName: 'Bless',
      targetIds: ['pc-1', 'pc-2'],
    });

    encounter = startConcentration(encounter, {
      casterId: 'pc-2',
      spellName: 'Guidance',
      targetId: 'pc-2',
    });

    const cleared = clearStatusEffects(encounter, ['pc-1']);

    expect(cleared.concentration?.['pc-1']).toBeUndefined();
    expect(cleared.actors['pc-1']?.conditions).toBeUndefined();
    expect(cleared.actors['pc-1']?.tags).toEqual([{ key: 'note:prep', text: 'Ready', id: expect.any(String), addedAtRound: expect.any(Number) }]);

    // Tags created via concentration for pc-1 are also removed from other actors.
    expect(cleared.actors['pc-2']?.tags?.some((tag) => tag.key === 'spell:guidance')).toBe(true);
    expect(cleared.actors['pc-2']?.tags?.some((tag) => tag.key === 'spell:bless')).toBeFalsy();
    expect(cleared.actors['pc-2']?.conditions?.restrained).toBe(true);

    // Goblin retains its tag because we did not clear it.
    expect(cleared.actors['m-1']?.tags?.some((tag) => tag.key === 'spell:hunters-mark')).toBe(true);
  });

  it('clears multiple actors and ignores unknown ids', () => {
    let encounter = setupEncounter();

    encounter = addActorTag(encounter, 'pc-1', { key: 'state:advantage', text: 'Advantage' });
    encounter = addActorTag(encounter, 'pc-2', { key: 'bardic-inspiration', text: 'Bardic Inspiration' });
    encounter = setCondition(encounter, 'pc-2', 'poisoned');

    encounter = startConcentration(encounter, {
      casterId: 'pc-2',
      spellName: 'Guidance',
      targetId: 'pc-2',
    });

    const cleared = clearStatusEffects(encounter, ['pc-1', 'pc-2', 'unknown']);

    expect(cleared.concentration?.['pc-2']).toBeUndefined();
    expect(cleared.actors['pc-1']?.tags).toEqual([]);
    expect(cleared.actors['pc-2']?.tags).toEqual([]);
    expect(cleared.actors['pc-2']?.conditions).toBeUndefined();
  });
});
