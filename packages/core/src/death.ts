export interface HitPointTotals {
  current?: number;
  max?: number;
  temp?: number;
}

export interface DeathState {
  successes: number;
  failures: number;
  stable?: boolean;
  dead?: boolean;
}

interface HitPointActor {
  hp?: number | HitPointTotals;
  maxHp?: number;
  name?: string;
  death?: DeathState;
}

function isHitPointTotals(value: unknown): value is HitPointTotals {
  return typeof value === 'object' && value !== null;
}

function finiteOrUndefined(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return undefined;
}

export function getCurrentHp(actor: HitPointActor): number {
  const hp = actor.hp;
  if (isHitPointTotals(hp)) {
    return finiteOrUndefined(hp.current) ?? finiteOrUndefined(hp.max) ?? 0;
  }
  return finiteOrUndefined(hp) ?? finiteOrUndefined(actor.maxHp) ?? 0;
}

export function getMaxHp(actor: HitPointActor): number {
  const hp = actor.hp;
  if (isHitPointTotals(hp)) {
    return finiteOrUndefined(hp.max) ?? finiteOrUndefined(actor.maxHp) ?? finiteOrUndefined(hp.current) ?? 0;
  }
  return finiteOrUndefined(actor.maxHp) ?? finiteOrUndefined(hp) ?? 0;
}

function setCurrentHp(actor: HitPointActor, value: number): void {
  const clamped = Number.isFinite(value) ? value : 0;
  const hp = actor.hp;
  if (isHitPointTotals(hp)) {
    actor.hp = { ...hp, current: clamped };
    return;
  }
  (actor as { hp?: number }).hp = clamped;
}

function createDeathState(): DeathState {
  return { successes: 0, failures: 0, stable: false, dead: false };
}

export function getDeath(actor: HitPointActor): DeathState {
  if (!actor.death) {
    actor.death = createDeathState();
  }
  return actor.death;
}

export function clearDeath(actor: HitPointActor): DeathState {
  const state = createDeathState();
  actor.death = state;
  return state;
}

export function applyHealing(actor: HitPointActor, amount: number): void {
  if (!Number.isFinite(amount) || amount <= 0) {
    return;
  }

  const current = getCurrentHp(actor);
  const max = getMaxHp(actor);
  const potential = current + amount;
  const next = Number.isFinite(max) && max > 0 ? Math.min(max, potential) : potential;
  setCurrentHp(actor, Math.max(0, next));

  if (getCurrentHp(actor) > 0) {
    clearDeath(actor);
  }
}

export function applyDamage(actor: HitPointActor, amount: number): void {
  if (!Number.isFinite(amount) || amount <= 0) {
    return;
  }

  const current = getCurrentHp(actor);
  const next = Math.max(0, current - amount);
  setCurrentHp(actor, next);

  if (next === 0) {
    const state = getDeath(actor);
    state.stable = false;
  }
}

function clampCounter(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 3) {
    return 3;
  }
  return Math.trunc(value);
}

export function rollDeathSave(actor: HitPointActor, d20: number): { line: string } {
  const roll = Math.trunc(d20);
  const name = actor.name ?? 'Unknown';
  const death = getDeath(actor);

  if (death.dead) {
    return { line: `${name} is dead.` };
  }

  if (getCurrentHp(actor) > 0) {
    return { line: `${name} is conscious (no death save needed).` };
  }

  if (death.stable) {
    return { line: `${name} is stable (no death save).` };
  }

  if (roll === 20) {
    setCurrentHp(actor, Math.max(1, getCurrentHp(actor))); // ensure at least 1 HP
    clearDeath(actor);
    return { line: `Death Save: NAT 20 — ${name} regains 1 HP!` };
  }

  if (roll === 1) {
    death.failures = clampCounter(death.failures + 2);
  } else if (roll >= 10) {
    death.successes = clampCounter(death.successes + 1);
  } else {
    death.failures = clampCounter(death.failures + 1);
  }

  if (death.successes >= 3) {
    death.successes = 3;
    death.stable = true;
    death.failures = clampCounter(death.failures);
    return { line: `Death Save: Success (3). ${name} is stable.` };
  }

  if (death.failures >= 3) {
    death.failures = 3;
    death.dead = true;
    return { line: `Death Save: Failure (3). ${name} has died.` };
  }

  const result = roll >= 10 ? 'Success' : 'Failure';
  return { line: `Death Save: ${result} — S:${death.successes} F:${death.failures}` };
}
