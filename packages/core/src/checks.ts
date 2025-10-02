import { AbilityName } from './abilityScores.js';
import { roll } from './dice.js';

export interface CheckOptions {
  ability: AbilityName;
  modifier?: number;
  proficient?: boolean;
  proficiencyBonus?: number;
  advantage?: boolean;
  disadvantage?: boolean;
  dc?: number;
  seed?: string;
}

export interface CheckResult {
  rolls: number[];
  total: number;
  success?: boolean;
  expression: string;
}

function formatModifier(value: number): string {
  if (value < 0) {
    return `${value}`;
  }
  return `+${value}`;
}

function resolveCheck(opts: CheckOptions): CheckResult {
  const {
    modifier = 0,
    proficient = false,
    proficiencyBonus,
    advantage = false,
    disadvantage = false,
    dc,
    seed,
  } = opts;

  const pbValue = proficient ? (Number.isFinite(proficiencyBonus) ? proficiencyBonus! : 2) : 0;

  const rollResult = roll('1d20', { advantage, disadvantage, seed });

  const total = rollResult.total + modifier + pbValue;

  const expressionParts = ['1d20'];
  if (modifier !== 0) {
    expressionParts.push(formatModifier(modifier));
  }
  if (pbValue !== 0) {
    expressionParts.push(formatModifier(pbValue));
  }

  let expression = expressionParts.join('');
  if (advantage) {
    expression += ' adv';
  } else if (disadvantage) {
    expression += ' dis';
  }
  if (typeof dc === 'number') {
    expression += ` vs DC ${dc}`;
  }

  const result: CheckResult = {
    rolls: rollResult.rolls,
    total,
    expression,
  };

  if (typeof dc === 'number') {
    result.success = total >= dc;
  }

  return result;
}

export function abilityCheck(opts: CheckOptions): CheckResult {
  return resolveCheck(opts);
}

export function savingThrow(opts: CheckOptions): CheckResult {
  return resolveCheck(opts);
}
