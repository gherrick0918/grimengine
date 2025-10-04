import { roll } from './dice.js';

export interface AttackRollOptions {
  abilityMod?: number;
  proficient?: boolean;
  proficiencyBonus?: number;
  advantage?: boolean;
  disadvantage?: boolean;
  seed?: string;
  targetAC?: number;
}

export interface AttackRollResult {
  d20s: number[];
  natural: number;
  total: number;
  isCrit: boolean;
  isFumble: boolean;
  hit?: boolean;
  expression: string;
}

export interface DamageRollOptions {
  expression: string;
  crit?: boolean;
  resistance?: boolean;
  vulnerability?: boolean;
  seed?: string;
}

export interface DamageRollResult {
  rolls: number[];
  critRolls?: number[];
  baseTotal: number;
  finalTotal: number;
  expression: string;
}

export interface ResolveAttackOptions extends AttackRollOptions {
  damage: DamageRollOptions;
}

export interface ResolveAttackResult {
  attack: AttackRollResult;
  damage?: DamageRollResult;
}

type ParsedTerm =
  | { type: 'dice'; sign: 1 | -1; count: number; sides: number }
  | { type: 'number'; sign: 1 | -1; value: number };

const TERM_PATTERN = /[+-]?[^+-]+/g;
const DEFAULT_PROFICIENCY_BONUS = 2;

function parseModifierString(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`;
}

function normalizeExpression(expr: string): { terms: ParsedTerm[]; normalized: string } {
  const compact = expr.replace(/\s+/g, '');
  if (!compact) {
    throw new Error('Empty damage expression');
  }

  const tokens = compact.match(TERM_PATTERN);
  if (!tokens) {
    throw new Error(`Invalid damage expression: ${expr}`);
  }

  const terms: ParsedTerm[] = [];

  tokens.forEach((rawToken) => {
    let token = rawToken;
    let sign: 1 | -1 = 1;

    if (token.startsWith('+')) {
      token = token.slice(1);
    } else if (token.startsWith('-')) {
      sign = -1;
      token = token.slice(1);
    }

    if (!token) {
      throw new Error(`Invalid token in damage expression: ${rawToken}`);
    }

    const diceMatch = token.match(/^(\d*)d(\d+)$/i);
    if (diceMatch) {
      const [, countStr, sidesStr] = diceMatch;
      const count = countStr ? Number.parseInt(countStr, 10) : 1;
      const sides = Number.parseInt(sidesStr, 10);

      if (!Number.isFinite(count) || count < 1) {
        throw new Error(`Invalid dice count in token: ${rawToken}`);
      }

      if (!Number.isFinite(sides) || sides < 2) {
        throw new Error(`Invalid dice sides in token: ${rawToken}`);
      }

      terms.push({ type: 'dice', sign, count, sides });
      return;
    }

    const value = Number.parseInt(token, 10);
    if (!Number.isFinite(value)) {
      throw new Error(`Invalid modifier in damage expression: ${rawToken}`);
    }

    terms.push({ type: 'number', sign, value });
  });

  const normalized = terms
    .map((term, index) => {
      const body = term.type === 'dice' ? `${term.count}d${term.sides}` : `${term.value}`;
      if (index === 0) {
        return term.sign === -1 ? `-${body}` : body;
      }
      const prefix = term.sign === -1 ? '-' : '+';
      return `${prefix}${body}`;
    })
    .join('');

  return { terms, normalized };
}

function computeModifierTotal(terms: ParsedTerm[]): number {
  return terms.reduce((sum, term) => {
    if (term.type === 'number') {
      return sum + term.sign * term.value;
    }
    return sum;
  }, 0);
}

function formatDamageExpression(base: string, opts: DamageRollOptions): string {
  const tags: string[] = [];
  if (opts.crit) {
    tags.push('crit');
  }
  if (opts.resistance) {
    tags.push('resist');
  }
  if (opts.vulnerability) {
    tags.push('vuln');
  }
  return tags.length > 0 ? `${base} (${tags.join(', ')})` : base;
}

export function attackRoll(opts: AttackRollOptions): AttackRollResult {
  if (opts.advantage && opts.disadvantage) {
    throw new Error('Cannot roll with both advantage and disadvantage');
  }

  const abilityMod = opts.abilityMod ?? 0;
  const proficiency = opts.proficient ? opts.proficiencyBonus ?? DEFAULT_PROFICIENCY_BONUS : 0;
  const totalModifier = abilityMod + proficiency;

  let d20s: number[];
  if (opts.advantage || opts.disadvantage) {
    const first = roll('1d20', {
      seed: opts.seed ? `${opts.seed}:0` : undefined,
    });
    const second = roll('1d20', {
      seed: opts.seed ? `${opts.seed}:1` : undefined,
    });
    d20s = [first.rolls[0], second.rolls[0]];
  } else {
    const rollResult = roll('1d20', { seed: opts.seed });
    d20s = [...rollResult.rolls];
  }

  const natural = opts.advantage
    ? Math.max(...d20s)
    : opts.disadvantage
    ? Math.min(...d20s)
    : d20s[0];

  const total = natural + totalModifier;
  const isCrit = natural === 20;
  const isFumble = natural === 1;

  let hit: boolean | undefined;
  if (typeof opts.targetAC === 'number') {
    hit = !isFumble && (isCrit || total >= opts.targetAC);
  }

  const modifierLabel = totalModifier !== 0 ? parseModifierString(totalModifier) : '';
  const advLabel = opts.advantage ? ' adv' : opts.disadvantage ? ' dis' : '';
  const acLabel = typeof opts.targetAC === 'number' ? ` vs AC ${opts.targetAC}` : '';
  const expression = `1d20${modifierLabel}${advLabel}${acLabel}`.trim();

  return {
    d20s,
    natural,
    total,
    isCrit,
    isFumble,
    hit,
    expression,
  };
}

export function damageRoll(opts: DamageRollOptions): DamageRollResult {
  const { terms, normalized } = normalizeExpression(opts.expression);
  const baseRoll = roll(normalized, { seed: opts.seed });

  const rolls = [...baseRoll.rolls];
  let diceIndex = 0;
  let signedDiceTotal = 0;

  terms.forEach((term) => {
    if (term.type === 'dice') {
      for (let i = 0; i < term.count; i += 1) {
        const value = rolls[diceIndex];
        if (typeof value !== 'number') {
          throw new Error('Dice roll mismatch in damageRoll');
        }
        signedDiceTotal += term.sign * value;
        diceIndex += 1;
      }
    }
  });

  const modifierTotal = computeModifierTotal(terms);

  let critRolls: number[] | undefined;
  let critDiceTotal = 0;
  if (opts.crit) {
    const diceTerms = terms.filter((term): term is Extract<ParsedTerm, { type: 'dice' }> => term.type === 'dice');
    if (diceTerms.length > 0) {
      const critTokens = diceTerms.map((term, index) => {
        const prefix = index === 0 ? (term.sign === -1 ? '-' : '') : term.sign === -1 ? '-' : '+';
        return `${prefix}${term.count}d${term.sides}`;
      });
      const critExpression = critTokens.join('');
      const critSeed = opts.seed ? `${opts.seed}:crit` : undefined;
      const critResult = roll(critExpression, { seed: critSeed });
      critRolls = [...critResult.rolls];
      critDiceTotal = critResult.total;
    }
  }

  const baseTotal = signedDiceTotal + critDiceTotal + modifierTotal;

  let finalTotal = baseTotal;
  if (opts.resistance) {
    finalTotal = Math.floor(finalTotal / 2);
  }
  if (opts.vulnerability) {
    finalTotal *= 2;
  }
  finalTotal = Math.max(0, Math.floor(finalTotal));

  return {
    rolls,
    critRolls,
    baseTotal,
    finalTotal,
    expression: formatDamageExpression(baseRoll.expression, opts),
  };
}

export function resolveAttack(opts: ResolveAttackOptions): ResolveAttackResult {
  const attack = attackRoll(opts);

  const shouldRollDamage =
    attack.isCrit || attack.hit === true || (typeof attack.hit === 'undefined' && !attack.isFumble);

  if (!shouldRollDamage) {
    return { attack };
  }

  const damage = damageRoll({ ...opts.damage, crit: attack.isCrit || opts.damage.crit });
  return { attack, damage };
}
