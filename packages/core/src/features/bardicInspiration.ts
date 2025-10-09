import { addActorTag, type ActorTag, type EncounterState, type Actor } from '../encounter.js';

const FEATURE_NAME = 'Bardic Inspiration';
const TAG_KEY = 'bardic-inspiration';
const DEFAULT_DIE = 'd6';
const VALID_DICE = new Set(['d6', 'd8', 'd10', 'd12']);

export type BardicInspirationDie = 'd6' | 'd8' | 'd10' | 'd12';

type Role = 'bard' | 'target';

type BardicInspirationValue =
  | string
  | {
      die?: string;
    };

function ensureActor(state: EncounterState, actorId: string, role: Role): Actor {
  const actor = state.actors[actorId];
  if (!actor) {
    throw new Error(`Unknown ${role} id: ${actorId}`);
  }
  return actor;
}

function normalizeText(value: string | undefined): string | undefined {
  return value ? value.toLowerCase().replace(/[^a-z0-9]+/g, '-') : undefined;
}

function isBardicInspirationTag(tag: ActorTag): boolean {
  const key = tag.key?.toLowerCase();
  if (key === TAG_KEY) {
    return true;
  }
  const normalized = normalizeText(tag.text);
  return normalized === TAG_KEY;
}

function removeBardicInspirationTags(state: EncounterState, targetId: string): EncounterState {
  const actor = state.actors[targetId];
  if (!actor || !actor.tags || actor.tags.length === 0) {
    return state;
  }

  const remaining = actor.tags.filter((tag) => {
    if (!isBardicInspirationTag(tag)) {
      return true;
    }
    return false;
  });

  if (remaining.length === actor.tags.length) {
    return state;
  }

  const updatedActor: Actor = { ...actor, tags: remaining };
  return { ...state, actors: { ...state.actors, [targetId]: updatedActor } };
}

function normalizeDie(raw: string | undefined): BardicInspirationDie {
  const die = raw?.toLowerCase();
  if (die && VALID_DICE.has(die)) {
    return die as BardicInspirationDie;
  }
  if (die) {
    throw new Error(`Unsupported Bardic Inspiration die: ${raw}. Expected one of d6, d8, d10, d12.`);
  }
  return DEFAULT_DIE;
}

function extractDieFromValue(value: BardicInspirationValue | undefined): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  if (value && typeof value === 'object' && value.die && typeof value.die === 'string') {
    return value.die;
  }
  return undefined;
}

export function hasBardicInspiration(tags: ActorTag[] | undefined): boolean {
  if (!tags || tags.length === 0) {
    return false;
  }
  return tags.some((tag) => isBardicInspirationTag(tag));
}

export function applyBardicInspiration(
  state: EncounterState,
  bardId: string,
  targetId: string,
  options?: { die?: BardicInspirationDie | string },
): EncounterState {
  ensureActor(state, bardId, 'bard');
  ensureActor(state, targetId, 'target');

  const die = normalizeDie(options?.die);

  let nextState = removeBardicInspirationTags(state, targetId);

  const source = `bard:${bardId}:inspiration`;
  nextState = addActorTag(nextState, targetId, {
    text: FEATURE_NAME,
    key: TAG_KEY,
    value: die,
    note: `Add ${die} to one ability check, attack roll, or saving throw`,
    source,
  });

  return nextState;
}

export function clearBardicInspiration(state: EncounterState, targetId: string): EncounterState {
  return removeBardicInspirationTags(state, targetId);
}

export function bardicInspirationDieFromTag(tag: ActorTag | undefined): string {
  if (!tag) {
    return DEFAULT_DIE;
  }
  const die = normalizeDie(extractDieFromValue(tag.value));
  return die;
}
