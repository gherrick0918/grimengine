import { describe, expect, it } from 'vitest';

import { longRest, shortRest } from '../src/rest.js';
import type { EncounterState, PlayerActor, MonsterActor } from '../src/encounter.js';

function createPlayer(
  overrides: Partial<PlayerActor> & Pick<PlayerActor, 'id' | 'name'>,
): PlayerActor {
  return {
    id: overrides.id,
    name: overrides.name,
    type: 'pc',
    side: overrides.side ?? 'party',
    ac: overrides.ac ?? 15,
    hp: overrides.hp ?? 10,
    maxHp: overrides.maxHp ?? 20,
    abilityMods: overrides.abilityMods ?? { CON: 1 },
    proficiencyBonus: overrides.proficiencyBonus ?? 3,
    defaultWeapon: overrides.defaultWeapon,
    conditions: overrides.conditions,
    tags: overrides.tags,
  };
}

function createMonster(overrides: Partial<MonsterActor> & Pick<MonsterActor, 'id' | 'name'>): MonsterActor {
  return {
    id: overrides.id,
    name: overrides.name,
    type: 'monster',
    side: overrides.side ?? 'foe',
    ac: overrides.ac ?? 13,
    hp: overrides.hp ?? 7,
    maxHp: overrides.maxHp ?? 7,
    abilityMods: overrides.abilityMods ?? { CON: 0 },
    attacks: overrides.attacks ?? [],
    tags: overrides.tags,
    conditions: overrides.conditions,
  };
}

function createEncounterState(): EncounterState {
  const kara = createPlayer({
    id: 'pc-1',
    name: 'Kara',
    hp: 5,
    maxHp: 25,
    abilityMods: { CON: 2 },
    conditions: { restrained: true },
    tags: [
      { id: 'tag-1', key: 'condition:restrained', text: 'Restrained' },
      { id: 'tag-2', key: 'bardic-inspiration', text: 'Bardic Inspiration' },
      { id: 'tag-3', key: 'note', text: 'Note' },
    ],
  });
  const bruni = createPlayer({ id: 'pc-2', name: 'Bruni', hp: 18, maxHp: 18, abilityMods: { CON: 3 } });
  const goblin = createMonster({ id: 'goblin-1', name: 'Goblin #1' });

  return {
    id: 'encounter-1',
    seed: 'seed',
    round: 1,
    turnIndex: 0,
    order: [],
    actors: {
      [kara.id]: kara,
      [bruni.id]: bruni,
      [goblin.id]: goblin,
    },
    defeated: new Set([kara.id]),
    lootLog: [],
    xpLog: [],
    concentration: {
      [kara.id]: { casterId: kara.id, spellName: 'Bless' },
    },
  };
}

describe('rest helpers', () => {
  it('applies deterministic short rest healing', () => {
    const encounter = createEncounterState();

    const result = shortRest(encounter, { who: 'Kara', hitDice: 2 });

    const healed = result.state.actors['pc-1'];
    expect(healed.hp).toBe(19);
    expect(healed.maxHp).toBe(25);
    expect(result.state.defeated.has('pc-1')).toBe(false);
    expect(result.lines).toContain('Kara → HP 19/25');
    expect(encounter.actors['pc-1'].hp).toBe(5);
  });

  it('restores party members on long rest', () => {
    const encounter = createEncounterState();

    const result = longRest(encounter, { who: 'party' });

    const kara = result.state.actors['pc-1'];
    const bruni = result.state.actors['pc-2'];

    expect(kara.hp).toBe(25);
    expect(kara.conditions).toBeUndefined();
    expect(kara.tags?.map((tag) => tag.id)).toEqual(['tag-3']);
    expect(bruni.hp).toBe(18);
    expect(result.state.defeated.has('pc-1')).toBe(false);
    expect(result.state.concentration && Object.keys(result.state.concentration)).toHaveLength(0);
    expect(result.lines).toContain('Kara → HP 25/25');
    expect(result.lines).toContain('Bruni → HP 18/18');
  });

  it('throws when no actors match the target', () => {
    const encounter = createEncounterState();

    expect(() => shortRest(encounter, { who: 'Unknown', hitDice: 1 })).toThrow(
      /No encounter actors match/,
    );
  });
});
