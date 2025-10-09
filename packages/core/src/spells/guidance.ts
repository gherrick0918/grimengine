import {
  addActorTag,
  startConcentration,
  endConcentration,
  type EncounterState,
  type Actor,
} from '../encounter.js';

const SPELL_NAME = 'Guidance';
const TAG_KEY = 'spell:guidance';
const TAG_NOTE = 'Add 1d4 to a single ability check';

type MutableActors = Record<string, Actor>;

type Role = 'caster' | 'target';

function guidanceSources(casterId: string): string[] {
  return [`conc:${casterId}:guidance`, `conc:${casterId}:Guidance`, casterId];
}

function ensureActor(state: EncounterState, actorId: string, role: Role): Actor {
  const actor = state.actors[actorId];
  if (!actor) {
    throw new Error(`Unknown ${role} id: ${actorId}`);
  }
  return actor;
}

function removeGuidanceTags(state: EncounterState, casterId: string): EncounterState {
  let updatedActors: MutableActors | null = null;
  const sources = new Set(guidanceSources(casterId));

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

export function startGuidance(state: EncounterState, casterId: string, targetId: string): EncounterState {
  ensureActor(state, casterId, 'caster');
  ensureActor(state, targetId, 'target');

  const source = guidanceSources(casterId)[0];

  let nextState = endConcentration(state, casterId);
  nextState = removeGuidanceTags(nextState, casterId);

  nextState = startConcentration(nextState, {
    casterId,
    spellName: SPELL_NAME,
    targetId,
  });

  nextState = addActorTag(nextState, targetId, {
    text: SPELL_NAME,
    key: TAG_KEY,
    value: true,
    note: TAG_NOTE,
    source,
  });

  return nextState;
}

export function endGuidance(state: EncounterState, casterId: string): EncounterState {
  let nextState = removeGuidanceTags(state, casterId);

  const entry = nextState.concentration?.[casterId];
  if (entry && entry.spellName.toLowerCase() === SPELL_NAME.toLowerCase()) {
    nextState = endConcentration(nextState, casterId);
  }

  return nextState;
}
