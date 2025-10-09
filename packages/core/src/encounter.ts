import type { AbilityName } from './abilityScores.js';
import type { Condition, ConditionSet } from './conditions.js';
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

export type Side = 'party' | 'foe' | 'neutral';

export interface ActorTag {
  id: string;
  text: string;
  addedAtRound: number;
  expiresAtRound?: number;
  note?: string;
  source?: string;
  key?: string;
  value?: unknown;
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

function nextActiveIndex(state: EncounterState, startIndex: number): { index: number; wrapped: boolean } {
  const { order } = state;
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
  const newTag: ActorTag = {
    ...tag,
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

export function nextTurn(state: EncounterState): EncounterState {
  if (state.order.length === 0) {
    return state;
  }

  let round = state.round;
  let turnIndex = state.turnIndex;

  const { index, wrapped } = nextActiveIndex(state, turnIndex);
  turnIndex = index;
  if (wrapped) {
    round += 1;
  }

  const nextState: EncounterState = { ...state, turnIndex, round };
  return expireActorTags(nextState);
}

export function currentActor(state: EncounterState): Actor | null {
  if (state.order.length === 0) {
    return null;
  }

  const currentEntry = state.order[state.turnIndex];
  if (!currentEntry) {
    return null;
  }

  if (!isActorActive(state, currentEntry.actorId)) {
    const firstActive = findFirstActiveIndex(state, state.order);
    if (firstActive === -1) {
      return null;
    }
    const entry = state.order[firstActive];
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
  const nextHp = Math.max(0, defender.hp - amount);
  const updatedDefender: Actor = { ...defender, hp: nextHp };
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
  const conditionFlags = attackAdvFromConditions(attacker.conditions, defender.conditions, mode);
  const combinedFlags = combineAdvantage(
    { advantage: opts?.advantage, disadvantage: opts?.disadvantage },
    conditionFlags,
  );

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

export function getConcentration(
  state: EncounterState,
  casterId: string,
): ConcentrationEntry | undefined {
  return state.concentration?.[casterId];
}

export function concentrationDCFromDamage(dmg: number): number {
  return Math.max(10, Math.floor(dmg / 2));
}
