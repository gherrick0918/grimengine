import {
  addActorTag,
  startConcentration,
  endConcentration,
  type EncounterState,
  type Actor,
} from '../encounter.js';

const SPELL_NAME = 'Bless';
const TAG_KEY = 'spell:bless';
const TAG_NOTE = 'Add 1d4 to attack rolls and saving throws';

type MutableActors = Record<string, Actor>;

type Role = 'caster' | 'target';

function blessSources(casterId: string): string[] {
  return [`conc:${casterId}:bless`, `conc:${casterId}:Bless`, casterId];
}

function ensureActor(state: EncounterState, actorId: string, role: Role): Actor {
  const actor = state.actors[actorId];
  if (!actor) {
    throw new Error(`Unknown ${role} id: ${actorId}`);
  }
  return actor;
}

function removeBlessTags(state: EncounterState, casterId: string): EncounterState {
  let updatedActors: MutableActors | null = null;
  const sources = new Set(blessSources(casterId));

  for (const [actorId, actor] of Object.entries(state.actors)) {
    const tags = actor.tags ?? [];
    if (tags.length === 0) {
      continue;
    }

    const remaining = tags.filter((tag) => {
      if (!tag.source || !sources.has(tag.source)) {
        return true;
      }
      if (tag.key && tag.key !== TAG_KEY) {
        return true;
      }
      if (!tag.key && tag.text !== SPELL_NAME) {
        return true;
      }
      return false;
    });

    if (remaining.length !== tags.length) {
      if (!updatedActors) {
        updatedActors = { ...state.actors };
      }
      updatedActors[actorId] = { ...actor, tags: remaining };
    }
  }

  if (!updatedActors) {
    return state;
  }

  return { ...state, actors: updatedActors };
}

export function startBless(state: EncounterState, casterId: string, targetIds: string[]): EncounterState {
  ensureActor(state, casterId, 'caster');

  const uniqueTargets: string[] = [];
  for (const targetId of targetIds) {
    if (!uniqueTargets.includes(targetId)) {
      uniqueTargets.push(targetId);
    }
  }

  if (uniqueTargets.length === 0) {
    throw new Error('Bless requires at least one target.');
  }

  const limitedTargets = uniqueTargets.slice(0, 3);
  for (const targetId of limitedTargets) {
    ensureActor(state, targetId, 'target');
  }

  let nextState = endConcentration(state, casterId);
  nextState = removeBlessTags(nextState, casterId);

  nextState = startConcentration(nextState, {
    casterId,
    spellName: SPELL_NAME,
    targetIds: limitedTargets,
  });

  const source = blessSources(casterId)[0];
  for (const targetId of limitedTargets) {
    nextState = addActorTag(nextState, targetId, {
      text: SPELL_NAME,
      key: TAG_KEY,
      value: true,
      note: TAG_NOTE,
      source,
    });
  }

  return nextState;
}

export function endBless(state: EncounterState, casterId: string): EncounterState {
  let nextState = removeBlessTags(state, casterId);
  const entry = nextState.concentration?.[casterId];
  if (entry && entry.spellName.toLowerCase() === SPELL_NAME.toLowerCase()) {
    nextState = endConcentration(nextState, casterId);
  }
  return nextState;
}
