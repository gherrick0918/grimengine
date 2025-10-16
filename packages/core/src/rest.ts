import type { Actor, ActorTag, EncounterState, Side, ConcentrationEntry } from './encounter.js';

type RestTarget = Side | string;

export interface RestResult {
  state: EncounterState;
  targets: Actor[];
  lines: string[];
}

export interface ShortRestOptions {
  who?: RestTarget;
  hitDice?: number;
  defaultDie?: number;
}

export interface LongRestOptions {
  who?: RestTarget;
}

const DEFAULT_TARGET: Side = 'party';
const DEFAULT_HIT_DIE = 8;
const CONDITION_TAG_PREFIX = 'condition:';
const BARDIC_INSPIRATION_KEY = 'bardic-inspiration';
const CONDITION_LABELS = new Set(['prone', 'restrained', 'poisoned', 'grappled', 'invisible']);

function avgDie(sides: number): number {
  if (!Number.isFinite(sides) || sides <= 0) {
    return 0;
  }
  return Math.ceil((sides + 1) / 2);
}

function conMod(actor: Actor): number {
  return actor.abilityMods.CON ?? 0;
}

function normalizeTarget(raw: RestTarget | undefined): RestTarget {
  if (typeof raw !== 'string') {
    return DEFAULT_TARGET;
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return DEFAULT_TARGET;
  }
  const lower = trimmed.toLowerCase();
  if (lower === 'party' || lower === 'foe' || lower === 'neutral') {
    return lower;
  }
  return trimmed;
}

function selectTargets(state: EncounterState, who: RestTarget): Array<{ id: string; actor: Actor }> {
  const entries = Object.entries(state.actors);
  if (who === 'party' || who === 'foe' || who === 'neutral') {
    const matches = entries.filter(([, actor]) => actor.side === who);
    if (matches.length === 0) {
      throw new Error(`No actors on side \"${who}\".`);
    }
    return matches;
  }

  const target = who.trim();
  const lower = target.toLowerCase();
  const matches = entries.filter(([id, actor]) => {
    if (id === target) {
      return true;
    }
    if (actor.name === target) {
      return true;
    }
    return actor.name.toLowerCase() === lower;
  });

  if (matches.length === 0) {
    throw new Error(`No encounter actors match \"${who}\".`);
  }

  return matches;
}

function formatLine(actor: Actor): string {
  return `${actor.name} → HP ${actor.hp}/${actor.maxHp}`;
}

function shouldRemoveTag(tag: ActorTag): boolean {
  const key = tag.key?.toLowerCase();
  if (key) {
    if (key === BARDIC_INSPIRATION_KEY) {
      return true;
    }
    if (key.startsWith(CONDITION_TAG_PREFIX)) {
      return true;
    }
  }

  const text = tag.text?.trim().toLowerCase();
  if (text) {
    if (text === 'bardic inspiration') {
      return true;
    }
    if (CONDITION_LABELS.has(text)) {
      return true;
    }
  }

  return false;
}

function cleanseTags(tags: ActorTag[] | undefined): ActorTag[] | undefined {
  if (!tags || tags.length === 0) {
    return tags;
  }
  const remaining = tags.filter((tag) => !shouldRemoveTag(tag));
  return remaining.length > 0 ? remaining : undefined;
}

function removeConcentrationEntries(
  state: EncounterState,
  casterIds: Set<string>,
): { next: Record<string, ConcentrationEntry> | undefined; changed: boolean } {
  const current = state.concentration;
  if (!current || Object.keys(current).length === 0) {
    return { next: current, changed: false };
  }

  let changed = false;
  const next: Record<string, ConcentrationEntry> = {};

  for (const [casterId, entry] of Object.entries(current)) {
    if (casterIds.has(casterId)) {
      changed = true;
      continue;
    }
    next[casterId] = entry;
  }

  if (!changed) {
    return { next: current, changed: false };
  }

  if (Object.keys(next).length === 0) {
    return { next: {}, changed: true };
  }

  return { next, changed: true };
}

export function shortRest(state: EncounterState, options: ShortRestOptions = {}): RestResult {
  const who = normalizeTarget(options.who);
  const entries = selectTargets(state, who);
  const hitDice = Number.isFinite(options.hitDice) ? Math.max(0, Math.floor(options.hitDice ?? 0)) : 0;
  const defaultDie = options.defaultDie && options.defaultDie > 0 ? Math.floor(options.defaultDie) : DEFAULT_HIT_DIE;

  let actorsCopy: Record<string, Actor> | null = null;
  let defeatedCopy: Set<string> | null = null;
  const targets: Actor[] = [];
  const lines: string[] = [];

  const ensureActorsCopy = () => {
    if (!actorsCopy) {
      actorsCopy = { ...state.actors };
    }
    return actorsCopy;
  };

  const ensureDefeatedCopy = () => {
    if (!defeatedCopy) {
      defeatedCopy = new Set(state.defeated);
    }
    return defeatedCopy;
  };

  for (const [id, actor] of entries) {
    let updated: Actor = actor;

    if (hitDice > 0) {
      const healPerDie = avgDie(defaultDie) + conMod(actor);
      const totalHeal = Math.max(0, healPerDie * hitDice);
      if (totalHeal > 0) {
        const nextHp = Math.min(actor.maxHp, actor.hp + totalHeal);
        if (nextHp !== actor.hp) {
          const actors = ensureActorsCopy();
          updated = { ...actor, hp: nextHp };
          actors[id] = updated;
          if (nextHp > 0 && state.defeated.has(id)) {
            ensureDefeatedCopy().delete(id);
          }
        }
      }
    }

    targets.push(updated);
    lines.push(formatLine(updated));
  }

  let nextState = state;
  if (actorsCopy) {
    nextState = { ...nextState, actors: actorsCopy };
  }
  if (defeatedCopy) {
    nextState = { ...nextState, defeated: defeatedCopy };
  }

  return { state: nextState, targets, lines };
}

export function longRest(state: EncounterState, options: LongRestOptions = {}): RestResult {
  const who = normalizeTarget(options.who);
  const entries = selectTargets(state, who);

  let actorsCopy: Record<string, Actor> | null = null;
  let defeatedCopy: Set<string> | null = null;
  const targets: Actor[] = [];
  const lines: string[] = [];
  const casterIds = new Set<string>();

  const ensureActorsCopy = () => {
    if (!actorsCopy) {
      actorsCopy = { ...state.actors };
    }
    return actorsCopy;
  };

  const ensureDefeatedCopy = () => {
    if (!defeatedCopy) {
      defeatedCopy = new Set(state.defeated);
    }
    return defeatedCopy;
  };

  for (const [id, actor] of entries) {
    const nextHp = actor.maxHp;
    const nextTags = cleanseTags(actor.tags);
    const nextConditions = actor.conditions ? undefined : actor.conditions;

    let updated: Actor = actor;
    const needsUpdate =
      actor.hp !== nextHp ||
      actor.conditions !== nextConditions ||
      actor.tags !== nextTags;

    if (needsUpdate) {
      const actors = ensureActorsCopy();
      updated = {
        ...actor,
        hp: nextHp,
        conditions: nextConditions,
        tags: nextTags,
      };
      actors[id] = updated;
    }

    if (state.defeated.has(id)) {
      ensureDefeatedCopy().delete(id);
    }

    casterIds.add(id);
    targets.push(updated);
    lines.push(formatLine(updated));
  }

  const { next: nextConcentration, changed: concentrationChanged } = removeConcentrationEntries(state, casterIds);

  let nextState = state;
  if (actorsCopy) {
    nextState = { ...nextState, actors: actorsCopy };
  }
  if (defeatedCopy) {
    nextState = { ...nextState, defeated: defeatedCopy };
  }
  if (concentrationChanged) {
    nextState = { ...nextState, concentration: nextConcentration ?? {} };
  }

  return { state: nextState, targets, lines };
}
