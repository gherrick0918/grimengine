export type Condition = 'prone' | 'restrained' | 'poisoned' | 'grappled';

export interface ConditionSet {
  [name: string]: true;
}

export function addCondition(set: ConditionSet | undefined, c: Condition): ConditionSet {
  return { ...(set ?? {}), [c]: true };
}

export function removeCondition(set: ConditionSet | undefined, c: Condition): ConditionSet | undefined {
  if (!set) return undefined;
  const { [c]: _removed, ...rest } = set;
  return Object.keys(rest).length ? rest : undefined;
}

export function hasCondition(set: ConditionSet | undefined, c: Condition): boolean {
  return !!set?.[c];
}

export function combineAdvantage(
  base: { advantage?: boolean; disadvantage?: boolean },
  extra: { advantage?: boolean; disadvantage?: boolean },
): { advantage?: boolean; disadvantage?: boolean } {
  const advantage = !!base.advantage || !!extra.advantage;
  const disadvantage = !!base.disadvantage || !!extra.disadvantage;

  if (advantage && disadvantage) {
    return {};
  }

  const result: { advantage?: boolean; disadvantage?: boolean } = {};
  if (advantage) {
    result.advantage = true;
  }
  if (disadvantage) {
    result.disadvantage = true;
  }
  return result;
}

export function attackAdvFromConditions(
  attacker: ConditionSet | undefined,
  defender: ConditionSet | undefined,
  mode: 'melee' | 'ranged',
): { advantage?: boolean; disadvantage?: boolean } {
  let advantage = false;
  let disadvantage = false;

  if (hasCondition(defender, 'prone')) {
    if (mode === 'melee') {
      advantage = true;
    } else if (mode === 'ranged') {
      disadvantage = true;
    }
  }

  if (hasCondition(defender, 'restrained')) {
    advantage = true;
  }

  if (hasCondition(attacker, 'restrained')) {
    disadvantage = true;
  }

  if (hasCondition(attacker, 'poisoned')) {
    disadvantage = true;
  }

  // Grappled does not affect attack rolls directly but is kept for completeness.

  const result: { advantage?: boolean; disadvantage?: boolean } = {};
  if (advantage) {
    result.advantage = true;
  }
  if (disadvantage) {
    result.disadvantage = true;
  }

  return result;
}
