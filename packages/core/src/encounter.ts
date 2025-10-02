import type { AbilityName } from './abilityScores.js';
import type { ResolveAttackResult } from './combat.js';
import { resolveAttack } from './combat.js';
import { roll } from './dice.js';

export type Side = 'party' | 'foe';

export interface ActorBase {
  id: string;
  name: string;
  side: Side;
  ac: number;
  hp: number;
  maxHp: number;
  abilityMods: Partial<Record<AbilityName, number>>;
  proficiencyBonus?: number;
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

export interface EncounterState {
  id: string;
  seed?: string;
  round: number;
  turnIndex: number;
  order: InitiativeEntry[];
  actors: Record<string, Actor>;
  defeated: Set<string>;
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
  };
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

  return { ...state, turnIndex, round };
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

export function actorAttack(
  state: EncounterState,
  attackerId: string,
  defenderId: string,
  opts?: { twoHanded?: boolean; advantage?: boolean; disadvantage?: boolean; seed?: string },
): { state: EncounterState; attack: ResolveAttackResult['attack']; damage?: ResolveAttackResult['damage']; defenderHp: number } {
  const attacker = state.actors[attackerId];
  const defender = state.actors[defenderId];
  if (!attacker) {
    throw new Error(`Unknown attacker: ${attackerId}`);
  }
  if (!defender) {
    throw new Error(`Unknown defender: ${defenderId}`);
  }

  const weapon = selectWeapon(attacker);
  const attackMod = weapon?.attackMod ?? 0;
  const baseSeed = opts?.seed ?? state.seed;
  const attackSeed = baseSeed ? `${baseSeed}:attack:${attackerId}->${defenderId}` : undefined;
  const damageSeed = attackSeed ? `${attackSeed}:damage` : undefined;

  const attackResult = resolveAttack({
    abilityMod: attackMod,
    proficient: false,
    advantage: opts?.advantage,
    disadvantage: opts?.disadvantage,
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
