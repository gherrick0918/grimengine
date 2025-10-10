import { addActorTag, type ActorTag, type EncounterState, type Actor } from '../encounter.js';

const FEATURE_NAME = 'Bardic Inspiration';
const TAG_KEY = 'bardic-inspiration';
const DEFAULT_DIE = 'd6';
const VALID_DICE = new Set(['d6', 'd8', 'd10', 'd12']);

interface BardicInspirationPayload {
  autoClear?: boolean;
  die?: string;
}

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

function extractDieFromPayload(payload: BardicInspirationPayload | undefined): string | undefined {
  if (payload && typeof payload.die === 'string') {
    return payload.die;
  }
  return undefined;
}

function normalizePayload(
  die: BardicInspirationDie,
  options?: { autoClear?: boolean },
): BardicInspirationPayload | undefined {
  if (!options?.autoClear) {
    return undefined;
  }

  return { autoClear: true, die };
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
  options?: { die?: BardicInspirationDie | string; autoClear?: boolean },
): EncounterState {
  ensureActor(state, bardId, 'bard');
  ensureActor(state, targetId, 'target');

  const die = normalizeDie(options?.die);
  const payload = normalizePayload(die, options);

  let nextState = removeBardicInspirationTags(state, targetId);

  const source = `bard:${bardId}:inspiration`;
  nextState = addActorTag(nextState, targetId, {
    text: FEATURE_NAME,
    key: TAG_KEY,
    value: die,
    note: `Add ${die} to one ability check, attack roll, or saving throw`,
    source,
    payload,
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
  const fromValue = extractDieFromValue(tag.value);
  if (fromValue) {
    return normalizeDie(fromValue);
  }
  const fromPayload = extractDieFromPayload(tag.payload as BardicInspirationPayload | undefined);
  if (fromPayload) {
    return normalizeDie(fromPayload);
  }
  return DEFAULT_DIE;
}

export function getBardicInspirationTag(tags: ActorTag[] | undefined): ActorTag | undefined {
  if (!tags || tags.length === 0) {
    return undefined;
  }

  return tags.find((tag) => isBardicInspirationTag(tag));
}

export function bardicInspirationAutoClears(tag: ActorTag | undefined): boolean {
  if (!tag) {
    return false;
  }
  const payload = tag.payload as BardicInspirationPayload | undefined;
  return Boolean(payload?.autoClear);
}

export function consumeBardicInspiration(
  state: EncounterState,
  targetId: string,
  options?: { autoOnly?: boolean },
): { state: EncounterState; consumed: boolean; removedTag?: ActorTag } {
  const actor = state.actors[targetId];
  if (!actor) {
    return { state, consumed: false };
  }

  const tag = getBardicInspirationTag(actor.tags);
  if (!tag) {
    return { state, consumed: false };
  }

  if (options?.autoOnly && !bardicInspirationAutoClears(tag)) {
    return { state, consumed: false };
  }

  const nextState = clearBardicInspiration(state, targetId);
  const updatedActor = nextState.actors[targetId];
  const consumed = !hasBardicInspiration(updatedActor?.tags);

  if (!consumed) {
    return { state, consumed: false };
  }

  return { state: nextState, consumed: true, removedTag: tag };
}
