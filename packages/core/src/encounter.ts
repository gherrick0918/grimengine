import type { AbilityName } from './abilityScores.js';
import type { Condition, ConditionSet } from './conditions.js';
import type { DeathState } from './death.js';
import {
  addCondition,
  attackAdvFromConditions,
  combineAdvantage,
  hasCondition,
  removeCondition,
} from './conditions.js';
import { abilityCheck } from './checks.js';
import type { ResolveAttackResult } from './combat.js';
import { resolveAttack } from './combat.js';
import { roll } from './dice.js';
import type { CoinBundle } from './loot.js';
import { applyDamage as applyDeathDamage, getCurrentHp } from './death.js';
import type { InventoryItem } from './inventory.js';

export type Side = 'party' | 'foe' | 'neutral';

export interface ActorTagDuration {
  rounds: number;
  at?: 'turnStart' | 'turnEnd';
}

export interface ActorTag {
  id: string;
  text: string;
  addedAtRound: number;
  expiresAtRound?: number;
  note?: string;
  source?: string;
  key?: string;
  value?: unknown;
  payload?: Record<string, unknown>;
  duration?: ActorTagDuration;
}

export interface ActorBase {
  id: string;
  name: string;
  side: Side;
  ac: number;
  hp: number;
  maxHp: number;
  abilityMods: Partial<Record<AbilityName, number>>;
  proficiencyBonus?: number;
  conditions?: ConditionSet;
  tags?: ActorTag[];
  death?: DeathState;
}

export interface WeaponProfile {
  name: string;
  attackMod: number;
  damageExpr: string;
  versatileExpr?: string;
}

export interface MonsterActor extends ActorBase {
  type: 'monster';
  attacks: WeaponProfile[];
}

export interface PlayerActor extends ActorBase {
  type: 'pc';
  defaultWeapon?: WeaponProfile;
}

export type Actor = MonsterActor | PlayerActor;

export interface InitiativeEntry {
  actorId: string;
  rolled: number;
  total: number;
}

export interface ConcentrationEntry {
  casterId: string;
  spellName: string;
  targetId?: string;
  targetIds?: string[];
}

export interface EncounterState {
  id: string;
  seed?: string;
  round: number;
  turnIndex: number;
  order: InitiativeEntry[];
  actors: Record<string, Actor>;
  defeated: Set<string>;
  lootLog?: { coins: CoinBundle; items: string[]; note?: string }[];
  xpLog?: { crs: string[]; total: number }[];
  concentration?: Record<string, ConcentrationEntry>;
  partyBag?: InventoryItem[];
  inventories?: Record<string, InventoryItem[]>;
}

export interface EncounterCheckInput {
  actorId: string;
  ability: AbilityName;
  dc?: number;
  baseMod: number;
  advantage?: boolean;
  disadvantage?: boolean;
  seed?: string;
}

/** For now: only poisoned affects ability checks (disadvantage). */
export function encounterAbilityCheck(state: EncounterState, input: EncounterCheckInput) {
  const actor = state.actors[input.actorId];
  if (!actor) {
    throw new Error('Unknown actor');
  }

  const conditionFlags = hasCondition(actor.conditions, 'poisoned') ? { disadvantage: true } : {};
  const combined = combineAdvantage(
    { advantage: input.advantage, disadvantage: input.disadvantage },
    conditionFlags,
  );

  return abilityCheck({
    ability: input.ability,
    modifier: input.baseMod,
    proficient: false,
    proficiencyBonus: 0,
    advantage: combined.advantage,
    disadvantage: combined.disadvantage,
    dc: input.dc,
    seed: input.seed,
  });
}

function cloneDefeated(set: Set<string>): Set<string> {
  return new Set(set);
}

function isActorActive(state: EncounterState, actorId: string): boolean {
  if (state.defeated.has(actorId)) {
    return false;
  }
  const actor = state.actors[actorId];
  if (!actor) {
    return false;
  }
  return actor.hp > 0;
}

function findFirstActiveIndex(state: EncounterState, order: InitiativeEntry[]): number {
  for (let i = 0; i < order.length; i += 1) {
    const entry = order[i];
    if (isActorActive(state, entry.actorId)) {
      return i;
    }
  }
  return -1;
}

function nextActiveIndex(
  state: EncounterState,
  order: InitiativeEntry[],
  startIndex: number,
): { index: number; wrapped: boolean } {
  if (order.length === 0) {
    return { index: 0, wrapped: false };
  }

  let index = startIndex;
  let wrapped = false;
  const total = order.length;
  for (let step = 0; step < total; step += 1) {
    const nextIndex = (index + 1) % total;
    if (!wrapped && nextIndex <= startIndex) {
      wrapped = true;
    }
    index = nextIndex;
    const actorId = order[index]?.actorId;
    if (actorId && isActorActive(state, actorId)) {
      return { index, wrapped };
    }
  }

  return { index: startIndex, wrapped: false };
}

function previousActiveIndex(
  state: EncounterState,
  order: InitiativeEntry[],
  startIndex: number,
): { index: number; wrapped: boolean } {
  if (order.length === 0) {
    return { index: 0, wrapped: false };
  }

  let index = startIndex;
  let wrapped = false;
  const total = order.length;
  for (let step = 0; step < total; step += 1) {
    const nextIndex = (index - 1 + total) % total;
    if (!wrapped && nextIndex >= startIndex) {
      wrapped = true;
    }
    index = nextIndex;
    const actorId = order[index]?.actorId;
    if (actorId && isActorActive(state, actorId)) {
      return { index, wrapped };
    }
  }

  return { index: startIndex, wrapped: false };
}

function sortInitiativeEntries(entries: InitiativeEntry[], state: EncounterState): InitiativeEntry[] {
  const decorated = entries.map((entry, index) => ({
    entry,
    index,
    dex: state.actors[entry.actorId]?.abilityMods?.DEX ?? 0,
    name: state.actors[entry.actorId]?.name ?? '',
  }));

  decorated.sort((a, b) => {
    if (b.entry.total !== a.entry.total) {
      return b.entry.total - a.entry.total;
    }
    if (b.dex !== a.dex) {
      return b.dex - a.dex;
    }
    const nameCompare = a.name.localeCompare(b.name);
    if (nameCompare !== 0) {
      return nameCompare;
    }
    return a.index - b.index;
  });

  return decorated.map((item) => item.entry);
}

function fallbackInitiativeOrder(state: EncounterState): InitiativeEntry[] {
  return Object.values(state.actors).map((actor) => ({
    actorId: actor.id,
    rolled: 0,
    total: 0,
  }));
}

function effectiveOrder(state: EncounterState): { order: InitiativeEntry[]; fallback: boolean } {
  if (state.order.length > 0) {
    return { order: state.order, fallback: false };
  }
  return { order: fallbackInitiativeOrder(state), fallback: true };
}

function clampTurnIndex(index: number, length: number): number {
  if (length <= 0) {
    return 0;
  }
  if (!Number.isFinite(index)) {
    return 0;
  }
  if (index < 0) {
    return 0;
  }
  if (index >= length) {
    return length - 1;
  }
  return index;
}

export function createEncounter(seed?: string): EncounterState {
  return {
    id: seed ? `encounter-${seed}` : 'encounter',
    seed,
    round: 0,
    turnIndex: 0,
    order: [],
    actors: {},
    defeated: new Set<string>(),
    lootLog: [],
    xpLog: [],
    concentration: {},
    partyBag: [],
    inventories: {},
  };
}

function nextTagIdentifier(tags: ActorTag[] | undefined): string {
  const existing = new Set((tags ?? []).map((tag) => tag.id));
  let index = 1;
  while (existing.has(`t${index}`)) {
    index += 1;
  }
  return `t${index}`;
}

export function addActorTag(
  state: EncounterState,
  actorId: string,
  tag: Omit<ActorTag, 'id' | 'addedAtRound'>,
): EncounterState {
  const actor = state.actors[actorId];
  if (!actor) {
    return state;
  }

  const currentTags = actor.tags ? [...actor.tags] : [];
  const { duration, ...rest } = tag;
  const newTag: ActorTag = {
    ...rest,
    duration: duration ? { ...duration } : undefined,
    id: nextTagIdentifier(actor.tags),
    addedAtRound: state.round,
  };
  const updatedActor: Actor = { ...actor, tags: [...currentTags, newTag] };
  return { ...state, actors: { ...state.actors, [actorId]: updatedActor } };
}

export function removeActorTag(state: EncounterState, actorId: string, tagId: string): EncounterState {
  const actor = state.actors[actorId];
  if (!actor || !actor.tags || actor.tags.length === 0) {
    return state;
  }

  const remaining = actor.tags.filter((tag) => tag.id !== tagId);
  if (remaining.length === actor.tags.length) {
    return state;
  }

  const updatedActor: Actor = { ...actor, tags: remaining };
  return { ...state, actors: { ...state.actors, [actorId]: updatedActor } };
}

export function clearActorTags(state: EncounterState, actorId: string): EncounterState {
  const actor = state.actors[actorId];
  if (!actor || !actor.tags || actor.tags.length === 0) {
    return state;
  }

  const updatedActor: Actor = { ...actor, tags: [] };
  return { ...state, actors: { ...state.actors, [actorId]: updatedActor } };
}

export function expireActorTags(state: EncounterState): EncounterState {
  let nextActors: Record<string, Actor> | null = null;
  const { round } = state;

  Object.entries(state.actors).forEach(([actorId, actor]) => {
    if (!actor.tags || actor.tags.length === 0) {
      return;
    }
    const remaining = actor.tags.filter(
      (tag) => typeof tag.expiresAtRound !== 'number' || round <= tag.expiresAtRound,
    );
    if (remaining.length === actor.tags.length) {
      return;
    }
    if (!nextActors) {
      nextActors = { ...state.actors };
    }
    nextActors[actorId] = { ...actor, tags: remaining };
  });

  if (!nextActors) {
    return state;
  }

  return { ...state, actors: nextActors };
}

export function clearAllConcentration(state: EncounterState): EncounterState {
  if (!state.concentration || Object.keys(state.concentration).length === 0) {
    return state;
  }
  return { ...state, concentration: {} };
}

export function addActor(state: EncounterState, actor: Actor): EncounterState {
  const actors = { ...state.actors, [actor.id]: actor };
  const defeated = cloneDefeated(state.defeated);
  if (actor.hp > 0) {
    defeated.delete(actor.id);
  } else {
    defeated.add(actor.id);
  }
  return { ...state, actors, defeated };
}

export function removeActor(state: EncounterState, actorId: string): EncounterState {
  const actors = { ...state.actors };
  delete actors[actorId];

  const order = state.order.filter((entry) => entry.actorId !== actorId);
  const defeated = cloneDefeated(state.defeated);
  defeated.delete(actorId);

  let turnIndex = state.turnIndex;
  const removedIndex = state.order.findIndex((entry) => entry.actorId === actorId);
  if (removedIndex !== -1) {
    if (order.length === 0) {
      turnIndex = 0;
    } else if (removedIndex < state.turnIndex || state.turnIndex >= order.length) {
      turnIndex = Math.max(0, Math.min(order.length - 1, state.turnIndex - 1));
    } else {
      turnIndex = Math.min(order.length - 1, state.turnIndex);
    }
  } else {
    turnIndex = Math.min(order.length - 1, turnIndex);
    if (turnIndex < 0) {
      turnIndex = 0;
    }
  }

  let round = state.round;
  if (order.length === 0) {
    round = 0;
  }

  const nextState: EncounterState = {
    ...state,
    actors,
    order,
    defeated,
    turnIndex,
    round,
  };

  const firstActive = findFirstActiveIndex(nextState, order);
  if (firstActive !== -1) {
    return { ...nextState, turnIndex: firstActive };
  }

  return nextState;
}

export function rollInitiative(state: EncounterState): EncounterState {
  const entries: InitiativeEntry[] = Object.values(state.actors).map((actor) => {
    const dexMod = actor.abilityMods?.DEX ?? 0;
    const seed = state.seed ? `${state.seed}:init:${actor.id}` : undefined;
    const result = roll('1d20', { seed });
    const rolled = result.rolls[0] ?? 0;
    return {
      actorId: actor.id,
      rolled,
      total: rolled + dexMod,
    };
  });

  const order = sortInitiativeEntries(entries, state);

  const nextState: EncounterState = {
    ...state,
    order,
    round: order.length > 0 ? 1 : 0,
    turnIndex: 0,
  };

  const firstActive = findFirstActiveIndex(nextState, order);
  if (firstActive !== -1) {
    return { ...nextState, turnIndex: firstActive };
  }

  return nextState;
}

export function setInitiative(state: EncounterState, actorId: string, score: number): EncounterState {
  const actor = state.actors[actorId];
  if (!actor) {
    throw new Error(`Unknown actor: ${actorId}`);
  }

  if (!Number.isFinite(score)) {
    throw new Error('Initiative score must be a finite number.');
  }

  const remaining = state.order.filter((entry) => entry.actorId !== actorId);
  const nextEntries = [...remaining, { actorId, rolled: score, total: score }];
  const order = sortInitiativeEntries(nextEntries, state);

  let nextState: EncounterState = { ...state, order };
  if (order.length === 0) {
    return { ...nextState, round: 0, turnIndex: 0 };
  }

  const baseRound = nextState.round > 0 ? nextState.round : 1;
  nextState = { ...nextState, round: baseRound, turnIndex: 0 };

  const firstActive = findFirstActiveIndex(nextState, order);
  if (firstActive !== -1) {
    nextState = { ...nextState, turnIndex: firstActive };
  }

  return nextState;
}

export function clearInitiative(state: EncounterState): EncounterState {
  if (state.order.length === 0 && state.turnIndex === 0 && state.round === 0) {
    return state;
  }
  return { ...state, order: [], turnIndex: 0, round: 0 };
}

type TurnPhase = 'turnStart' | 'turnEnd';

function tickActorTagDurations(
  state: EncounterState,
  actorId: string,
  phase: TurnPhase,
): { state: EncounterState; expired: ActorTag[] } {
  const actor = state.actors[actorId];
  if (!actor || !actor.tags || actor.tags.length === 0) {
    return { state, expired: [] };
  }

  let changed = false;
  const nextTags: ActorTag[] = [];
  const expired: ActorTag[] = [];

  actor.tags.forEach((tag) => {
    const duration = tag.duration;
    if (!duration) {
      nextTags.push(tag);
      return;
    }
    const at = duration.at ?? 'turnEnd';
    if (at !== phase) {
      nextTags.push(tag);
      return;
    }
    const remaining = typeof duration.rounds === 'number' ? duration.rounds : 0;
    if (remaining <= 1) {
      changed = true;
      expired.push(tag);
      return;
    }
    changed = true;
    nextTags.push({ ...tag, duration: { ...duration, rounds: remaining - 1 } });
  });

  if (!changed) {
    return { state, expired: [] };
  }

  const updatedActor: Actor = { ...actor, tags: nextTags };
  const nextState: EncounterState = { ...state, actors: { ...state.actors, [actorId]: updatedActor } };
  return { state: nextState, expired };
}

export function nextTurn(state: EncounterState): EncounterState {
  const { order, fallback } = effectiveOrder(state);
  if (order.length === 0) {
    return state;
  }

  let turnIndex = clampTurnIndex(state.turnIndex, order.length);
  const currentEntry = order[turnIndex];
  if (!currentEntry || !isActorActive(state, currentEntry.actorId)) {
    const firstActive = findFirstActiveIndex(state, order);
    if (firstActive === -1) {
      return state;
    }
    turnIndex = firstActive;
  }

  let nextState = state.turnIndex === turnIndex ? state : { ...state, turnIndex };

  const currentActorId = order[turnIndex]?.actorId;
  if (currentActorId) {
    const tickResult = tickActorTagDurations(nextState, currentActorId, 'turnEnd');
    nextState = tickResult.state;
  }

  let round = fallback ? Math.max(nextState.round, 1) : nextState.round;

  const { index, wrapped } = nextActiveIndex(nextState, order, turnIndex);
  turnIndex = index;
  if (wrapped) {
    round += 1;
  }

  nextState = { ...nextState, turnIndex, round };
  nextState = expireActorTags(nextState);

  const nextActorId = order[turnIndex]?.actorId;
  if (nextActorId) {
    const tickResult = tickActorTagDurations(nextState, nextActorId, 'turnStart');
    nextState = tickResult.state;
  }

  return nextState;
}

export function previousTurn(state: EncounterState): EncounterState {
  const { order, fallback } = effectiveOrder(state);
  if (order.length === 0) {
    return state;
  }

  let turnIndex = clampTurnIndex(state.turnIndex, order.length);
  const currentEntry = order[turnIndex];
  if (!currentEntry || !isActorActive(state, currentEntry.actorId)) {
    const firstActive = findFirstActiveIndex(state, order);
    if (firstActive === -1) {
      return state;
    }
    turnIndex = firstActive;
  }

  let round = fallback ? Math.max(state.round, 1) : state.round;
  const { index, wrapped } = previousActiveIndex(state, order, turnIndex);
  turnIndex = index;
  if (wrapped) {
    round = Math.max(fallback ? 1 : 0, round - 1);
  }

  const nextState: EncounterState = expireActorTags({ ...state, turnIndex, round });
  return nextState;
}

export function currentActor(state: EncounterState): Actor | null {
  const { order } = effectiveOrder(state);
  if (order.length === 0) {
    return null;
  }

  const turnIndex = clampTurnIndex(state.turnIndex, order.length);
  const currentEntry = order[turnIndex];
  if (!currentEntry) {
    return null;
  }

  if (!isActorActive(state, currentEntry.actorId)) {
    const firstActive = findFirstActiveIndex(state, order);
    if (firstActive === -1) {
      return null;
    }
    const entry = order[firstActive];
    return entry ? state.actors[entry.actorId] ?? null : null;
  }

  return state.actors[currentEntry.actorId] ?? null;
}

function selectWeapon(actor: Actor): WeaponProfile | undefined {
  if (actor.type === 'monster') {
    return actor.attacks[0];
  }
  return actor.defaultWeapon;
}

function resolveDamageExpression(profile: WeaponProfile, twoHanded?: boolean): string {
  if (twoHanded && profile.versatileExpr) {
    return profile.versatileExpr;
  }
  return profile.damageExpr;
}

function applyDamage(state: EncounterState, defenderId: string, amount: number): EncounterState {
  const defender = state.actors[defenderId];
  if (!defender) {
    return state;
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return state;
  }

  const updatedDefender: Actor = { ...defender };
  applyDeathDamage(updatedDefender, amount);
  const nextHp = getCurrentHp(updatedDefender);
  const actors = { ...state.actors, [defenderId]: updatedDefender };
  const defeated = cloneDefeated(state.defeated);
  if (nextHp === 0) {
    defeated.add(defenderId);
  } else {
    defeated.delete(defenderId);
  }
  return { ...state, actors, defeated };
}

export function setCondition(state: EncounterState, actorId: string, cond: Condition): EncounterState {
  const actor = state.actors[actorId];
  if (!actor) {
    return state;
  }

  const updated: Actor = { ...actor, conditions: addCondition(actor.conditions, cond) };
  return { ...state, actors: { ...state.actors, [actorId]: updated } };
}

export function clearCondition(state: EncounterState, actorId: string, cond: Condition): EncounterState {
  const actor = state.actors[actorId];
  if (!actor) {
    return state;
  }

  const updated: Actor = { ...actor, conditions: removeCondition(actor.conditions, cond) };
  return { ...state, actors: { ...state.actors, [actorId]: updated } };
}

export function actorAttack(
  state: EncounterState,
  attackerId: string,
  defenderId: string,
  opts?: {
    mode?: 'melee' | 'ranged';
    twoHanded?: boolean;
    advantage?: boolean;
    disadvantage?: boolean;
    seed?: string;
    advStateOverride?: 'normal' | 'advantage' | 'disadvantage';
  },
): { state: EncounterState; attack: ResolveAttackResult['attack']; damage?: ResolveAttackResult['damage']; defenderHp: number } {
  const attacker = state.actors[attackerId];
  const defender = state.actors[defenderId];
  if (!attacker) {
    throw new Error(`Unknown attacker: ${attackerId}`);
  }
  if (!defender) {
    throw new Error(`Unknown defender: ${defenderId}`);
  }
  if (state.defeated.has(attackerId)) {
    throw new Error('Attacker is defeated.');
  }
  if (state.defeated.has(defenderId)) {
    throw new Error('Target is defeated.');
  }

  const weapon = selectWeapon(attacker);
  const attackMod = weapon?.attackMod ?? 0;
  const baseSeed = opts?.seed ?? state.seed;
  const attackSeedBase = baseSeed ? `${baseSeed}:attack:${attackerId}->${defenderId}` : undefined;
  const attackSeed = attackSeedBase ? `${attackSeedBase}:atk` : undefined;
  const damageSeed = attackSeedBase ? `${attackSeedBase}:damage` : undefined;

  const mode = opts?.mode ?? 'melee';
  let combinedFlags: { advantage?: boolean; disadvantage?: boolean };

  if (opts?.advStateOverride) {
    if (opts.advStateOverride === 'advantage') {
      combinedFlags = { advantage: true };
    } else if (opts.advStateOverride === 'disadvantage') {
      combinedFlags = { disadvantage: true };
    } else {
      combinedFlags = {};
    }
  } else {
    const conditionFlags = attackAdvFromConditions(attacker.conditions, defender.conditions, mode);
    combinedFlags = combineAdvantage(
      { advantage: opts?.advantage, disadvantage: opts?.disadvantage },
      conditionFlags,
    );
  }

  const attackResult = resolveAttack({
    abilityMod: attackMod,
    proficient: false,
    advantage: combinedFlags.advantage,
    disadvantage: combinedFlags.disadvantage,
    seed: attackSeed,
    targetAC: defender.ac,
    damage: {
      expression: resolveDamageExpression(
        weapon ?? { name: 'Unarmed', attackMod: 0, damageExpr: '1d4' },
        opts?.twoHanded,
      ),
      seed: damageSeed,
    },
  });

  let nextState = state;
  let defenderHp = defender.hp;
  const damage = attackResult.damage;

  if (attackResult.attack.isCrit || attackResult.attack.hit === true) {
    const damageTotal = damage?.finalTotal ?? 0;
    nextState = applyDamage(nextState, defenderId, damageTotal);
    defenderHp = nextState.actors[defenderId]?.hp ?? 0;
  }

  if (attackResult.attack.isFumble || attackResult.attack.hit === false) {
    nextState = { ...nextState };
  }

  return { state: nextState, attack: attackResult.attack, damage, defenderHp };
}

export function recordLoot(
  state: EncounterState,
  entry: { coins: CoinBundle; items: string[]; note?: string },
): EncounterState {
  const existing = state.lootLog ?? [];
  const nextEntry = {
    coins: { ...entry.coins },
    items: [...entry.items],
    note: entry.note,
  };
  return { ...state, lootLog: [...existing, nextEntry] };
}

export function recordXP(state: EncounterState, entry: { crs: string[]; total: number }): EncounterState {
  const existing = state.xpLog ?? [];
  const nextEntry = {
    crs: [...entry.crs],
    total: entry.total,
  };
  return { ...state, xpLog: [...existing, nextEntry] };
}

export function startConcentration(state: EncounterState, entry: ConcentrationEntry): EncounterState {
  const existing = state.concentration ?? {};
  const concentration: Record<string, ConcentrationEntry> = {
    ...existing,
    [entry.casterId]: { ...entry },
  };
  return { ...state, concentration };
}

export function endConcentration(state: EncounterState, casterId: string): EncounterState {
  if (!state.concentration || !state.concentration[casterId]) {
    return state.concentration ? state : { ...state, concentration: {} };
  }

  const concentration = { ...state.concentration };
  delete concentration[casterId];

  let nextActors: Record<string, Actor> | undefined;
  for (const [actorId, actor] of Object.entries(state.actors)) {
    const tags = actor.tags ?? [];
    if (tags.length === 0) {
      continue;
    }
    const remaining = tags.filter((tag) => !(tag.source && tag.source.startsWith(`conc:${casterId}:`)));
    if (remaining.length !== tags.length) {
      if (!nextActors) {
        nextActors = { ...state.actors };
      }
      nextActors[actorId] = { ...actor, tags: remaining };
    }
  }

  return nextActors ? { ...state, concentration, actors: nextActors } : { ...state, concentration };
}

const CLEARABLE_TAG_PREFIXES = ['condition:', 'spell:'];
const CLEARABLE_TAG_KEYS = new Set(['bardic-inspiration', 'state:advantage', 'state:disadvantage']);
const CLEARABLE_TAG_TEXTS = new Set(['bardic inspiration']);

function shouldClearTag(tag: ActorTag): boolean {
  const key = tag.key?.toLowerCase();
  if (key) {
    if (CLEARABLE_TAG_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      return true;
    }
    if (CLEARABLE_TAG_KEYS.has(key)) {
      return true;
    }
  }

  const text = tag.text?.toLowerCase();
  if (text && CLEARABLE_TAG_TEXTS.has(text)) {
    return true;
  }

  return false;
}

export function clearStatusEffects(state: EncounterState, actorIds: string[]): EncounterState {
  if (!actorIds || actorIds.length === 0) {
    return state;
  }

  const uniqueIds = Array.from(new Set(actorIds));
  let workingState = state;

  for (const actorId of uniqueIds) {
    workingState = endConcentration(workingState, actorId);
  }

  let nextActors: Record<string, Actor> | undefined;

  for (const actorId of uniqueIds) {
    const actor = workingState.actors[actorId];
    if (!actor) {
      continue;
    }

    const tags = actor.tags ?? [];
    const remainingTags = tags.filter((tag) => !shouldClearTag(tag));
    const tagsChanged = remainingTags.length !== tags.length;
    const hadConditions = actor.conditions && Object.keys(actor.conditions).length > 0;

    if (!tagsChanged && !hadConditions) {
      continue;
    }

    const updated: Actor = { ...actor };
    if (tagsChanged) {
      updated.tags = remainingTags;
    }
    if (hadConditions) {
      updated.conditions = undefined;
    }

    if (!nextActors) {
      nextActors = { ...workingState.actors };
    }
    nextActors[actorId] = updated;
  }

  if (!nextActors) {
    return workingState;
  }

  return { ...workingState, actors: nextActors };
}

export function getConcentration(
  state: EncounterState,
  casterId: string,
): ConcentrationEntry | undefined {
  return state.concentration?.[casterId];
}

export function concentrationDCFromDamage(dmg: number): number {
  return Math.max(10, Math.floor(dmg / 2));
}
