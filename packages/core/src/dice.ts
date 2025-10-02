import seedrandom from './vendor-seedrandom.js';

export interface RollOptions {
  seed?: string;
  advantage?: boolean;
  disadvantage?: boolean;
}

export interface RollResult {
  total: number;
  rolls: number[];
  expression: string;
}

type Term =
  | { type: 'dice'; sign: 1 | -1; count: number; sides: number }
  | { type: 'number'; sign: 1 | -1; value: number };

const TERM_PATTERN = /[+-]?[^+-]+/g;

function parseExpression(expr: string): { terms: Term[]; normalized: string } {
  const compact = expr.replace(/\s+/g, '');
  if (!compact) {
    throw new Error('Empty dice expression');
  }

  const tokens = compact.match(TERM_PATTERN);
  if (!tokens) {
    throw new Error(`Invalid dice expression: ${expr}`);
  }

  const terms: Term[] = [];

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
      throw new Error(`Invalid token in expression: ${rawToken}`);
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
      throw new Error(`Invalid modifier in token: ${rawToken}`);
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

function rollDie(sides: number, random: () => number): number {
  return Math.floor(random() * sides) + 1;
}

export function roll(expr: string, opts: RollOptions = {}): RollResult {
  if (opts.advantage && opts.disadvantage) {
    throw new Error('Cannot roll with both advantage and disadvantage');
  }

  const { terms, normalized } = parseExpression(expr);
  const rng = seedrandom(opts.seed);

  const rolls: number[] = [];
  let total = 0;

  const advantageRequested = Boolean(opts.advantage || opts.disadvantage);
  let advantageApplied = false;

  const targetIndex = advantageRequested
    ? terms.findIndex((term) => term.type === 'dice' && term.count === 1 && term.sides === 20)
    : -1;

  terms.forEach((term, index) => {
    if (term.type === 'dice') {
      const shouldApplyAdvantage =
        advantageRequested && !advantageApplied && (index === targetIndex || targetIndex === -1);

      if (shouldApplyAdvantage && term.count === 1) {
        const first = rollDie(term.sides, rng);
        const second = rollDie(term.sides, rng);
        rolls.push(first, second);
        const chosen = opts.advantage ? Math.max(first, second) : Math.min(first, second);
        total += term.sign * chosen;
        advantageApplied = true;
      } else {
        for (let i = 0; i < term.count; i += 1) {
          const value = rollDie(term.sides, rng);
          rolls.push(value);
          total += term.sign * value;
        }
      }
    } else {
      total += term.sign * term.value;
    }
  });

  const expression = `${normalized}${opts.advantage ? ' adv' : opts.disadvantage ? ' dis' : ''}`;

  return {
    total,
    rolls,
    expression,
  };
}
