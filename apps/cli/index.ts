import {
  abilityCheck,
  roll,
  rollAbilityScores,
  savingThrow,
  standardArray,
  validatePointBuy,
  type AbilityName,
} from '@grimengine/core';

function showUsage(): void {
  console.log('Usage:');
  console.log('  pnpm dev -- roll "<expression>" [adv|dis] [--seed <value>]');
  console.log('  pnpm dev -- check <ability> [modifier] [--dc <n>] [--proficient] [--pb <n>] [--adv|--dis] [--seed <value>]');
  console.log('  pnpm dev -- save <ability> [modifier] [--dc <n>] [--proficient] [--pb <n>] [--adv|--dis] [--seed <value>]');
  console.log('  pnpm dev -- abilities roll [--seed <value>] [--count <n>] [--drop <n>] [--sort asc|desc|none]');
  console.log('  pnpm dev -- abilities standard');
  console.log('  pnpm dev -- abilities pointbuy "<comma-separated scores>"');
}

const ABILITY_NAMES: AbilityName[] = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

function isAbilityName(value: string): value is AbilityName {
  return ABILITY_NAMES.includes(value as AbilityName);
}

function parseModifier(value: string | undefined): number {
  if (!value) {
    return 0;
  }

  if (value.startsWith('--')) {
    return 0;
  }

  const cleaned = value.replace(/^\+/, '');
  const parsed = Number.parseInt(cleaned, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid modifier: ${value}`);
  }
  return parsed;
}

function formatModifier(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`;
}

function handleCheckCommand(type: 'check' | 'save', rawArgs: string[]): void {
  if (rawArgs.length === 0) {
    console.error('Missing ability for check.');
    showUsage();
    process.exit(1);
  }

  const abilityRaw = rawArgs[0].toUpperCase();
  if (!isAbilityName(abilityRaw)) {
    console.error(`Invalid ability name: ${rawArgs[0]}`);
    process.exit(1);
  }
  const ability = abilityRaw as AbilityName;

  let modifier = 0;
  let startIndex = 1;
  try {
    modifier = parseModifier(rawArgs[1]);
    if (rawArgs[1] && !rawArgs[1].startsWith('--')) {
      startIndex = 2;
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
  }

  let proficient = false;
  let proficiencyBonus: number | undefined;
  let advantage = false;
  let disadvantage = false;
  let dc: number | undefined;
  let seed: string | undefined;

  for (let i = startIndex; i < rawArgs.length; i += 1) {
    const arg = rawArgs[i];
    const lower = arg.toLowerCase();

    if (lower === '--proficient') {
      proficient = true;
      continue;
    }

    if (lower === '--adv' || lower === '--advantage') {
      advantage = true;
      continue;
    }

    if (lower === '--dis' || lower === '--disadvantage' || lower === '--disadv') {
      disadvantage = true;
      continue;
    }

    if (arg.startsWith('--pb=')) {
      const value = Number.parseInt(arg.slice('--pb='.length), 10);
      if (Number.isNaN(value)) {
        console.error('Proficiency bonus must be a number.');
        process.exit(1);
      }
      proficiencyBonus = value;
      continue;
    }

    if (lower === '--pb') {
      if (i + 1 >= rawArgs.length) {
        console.error('Expected value after --pb.');
        process.exit(1);
      }
      const value = Number.parseInt(rawArgs[i + 1], 10);
      if (Number.isNaN(value)) {
        console.error('Proficiency bonus must be a number.');
        process.exit(1);
      }
      proficiencyBonus = value;
      i += 1;
      continue;
    }

    if (arg.startsWith('--dc=')) {
      const value = Number.parseInt(arg.slice('--dc='.length), 10);
      if (Number.isNaN(value)) {
        console.error('DC must be an integer.');
        process.exit(1);
      }
      dc = value;
      continue;
    }

    if (lower === '--dc') {
      if (i + 1 >= rawArgs.length) {
        console.error('Expected value after --dc.');
        process.exit(1);
      }
      const value = Number.parseInt(rawArgs[i + 1], 10);
      if (Number.isNaN(value)) {
        console.error('DC must be an integer.');
        process.exit(1);
      }
      dc = value;
      i += 1;
      continue;
    }

    if (arg.startsWith('--seed=')) {
      seed = arg.slice('--seed='.length);
      continue;
    }

    if (lower === '--seed') {
      if (i + 1 >= rawArgs.length) {
        console.error('Expected value after --seed.');
        process.exit(1);
      }
      seed = rawArgs[i + 1];
      i += 1;
      continue;
    }

    console.warn(`Ignoring unknown argument: ${arg}`);
  }

  if (advantage && disadvantage) {
    console.error('Cannot roll with both advantage and disadvantage.');
    process.exit(1);
  }

  const options = {
    ability,
    modifier,
    proficient,
    proficiencyBonus,
    advantage,
    disadvantage,
    dc,
    seed,
  } as const;

  const result = type === 'check' ? abilityCheck(options) : savingThrow(options);

  const pbUsed = proficient
    ? (Number.isFinite(proficiencyBonus) ? (proficiencyBonus as number) : 2)
    : 0;
  const pbLabel = proficient ? ` (proficient ${formatModifier(pbUsed)})` : '';
  const modifierLabel = formatModifier(modifier);
  const advLabel = advantage ? ' adv' : disadvantage ? ' dis' : '';
  const dcLabel = typeof dc === 'number' ? ` vs DC ${dc}` : '';
  const title = type === 'check' ? 'Ability Check' : 'Saving Throw';

  console.log(
    `${title}: ${abilityRaw} ${modifierLabel}${pbLabel}${advLabel}${dcLabel}`.trim(),
  );
  console.log(`Rolls: [${result.rolls.join(', ')}] → total ${result.total}`);
  if (typeof result.success === 'boolean') {
    console.log(`Result: ${result.success ? 'SUCCESS' : 'FAILURE'}`);
  } else {
    console.log(`Result: ${result.total}`);
  }
  process.exit(0);
}

const [, , ...argv] = process.argv;
const args = argv[0] === '--' ? argv.slice(1) : argv;

if (args.length === 0 || args[0] === 'help' || args[0] === '--help') {
  showUsage();
  process.exit(0);
}

const [command, ...rest] = args;

if (command === 'roll') {
  if (rest.length === 0) {
    console.error('Missing dice expression.');
    showUsage();
    process.exit(1);
  }

  const [expression, ...rawArgs] = rest;
  let advantage = false;
  let disadvantage = false;
  let seed: string | undefined;

  for (let i = 0; i < rawArgs.length; i += 1) {
    const arg = rawArgs[i];
    const lower = arg.toLowerCase();
    if (lower === 'adv' || lower === 'advantage') {
      advantage = true;
      continue;
    }
    if (lower === 'dis' || lower === 'disadvantage' || lower === 'disadv') {
      disadvantage = true;
      continue;
    }
    if (arg.startsWith('--seed=')) {
      seed = arg.slice('--seed='.length);
      continue;
    }
    if (lower === '--seed') {
      if (i + 1 >= rawArgs.length) {
        console.error('Expected value after --seed.');
        process.exit(1);
      }
      seed = rawArgs[i + 1];
      i += 1;
      continue;
    }

    console.warn(`Ignoring unknown argument: ${arg}`);
  }

  if (advantage && disadvantage) {
    console.error('Cannot roll with both advantage and disadvantage.');
    process.exit(1);
  }

  const advLabel = advantage ? ' with advantage' : disadvantage ? ' with disadvantage' : '';
  console.log(`Rolling ${expression}${advLabel}...`);

  const result = roll(expression, { advantage, disadvantage, seed });

  console.log(`Rolls: [${result.rolls.join(', ')}] → total ${result.total}`);
  process.exit(0);
}

if (command === 'check' || command === 'save') {
  handleCheckCommand(command, rest);
}

if (command === 'abilities') {
  if (rest.length === 0) {
    console.error('Missing abilities subcommand.');
    showUsage();
    process.exit(1);
  }

  const [subcommand, ...rawArgs] = rest;

  if (subcommand === 'roll') {
    let seed: string | undefined;
    let count: number | undefined;
    let drop: number | undefined;
    let sort: 'none' | 'asc' | 'desc' | undefined;

    for (let i = 0; i < rawArgs.length; i += 1) {
      const arg = rawArgs[i];
      if (arg.startsWith('--seed=')) {
        seed = arg.slice('--seed='.length);
        continue;
      }
      if (arg === '--seed') {
        if (i + 1 >= rawArgs.length) {
          console.error('Expected value after --seed.');
          process.exit(1);
        }
        seed = rawArgs[i + 1];
        i += 1;
        continue;
      }
      if (arg.startsWith('--count=')) {
        const value = Number.parseInt(arg.slice('--count='.length), 10);
        if (Number.isNaN(value) || value <= 0) {
          console.error('Count must be a positive integer.');
          process.exit(1);
        }
        count = value;
        continue;
      }
      if (arg === '--count') {
        if (i + 1 >= rawArgs.length) {
          console.error('Expected value after --count.');
          process.exit(1);
        }
        const value = Number.parseInt(rawArgs[i + 1], 10);
        if (Number.isNaN(value) || value <= 0) {
          console.error('Count must be a positive integer.');
          process.exit(1);
        }
        count = value;
        i += 1;
        continue;
      }
      if (arg.startsWith('--drop=')) {
        const value = Number.parseInt(arg.slice('--drop='.length), 10);
        if (Number.isNaN(value) || value < 0) {
          console.error('Drop must be zero or a positive integer.');
          process.exit(1);
        }
        drop = value;
        continue;
      }
      if (arg === '--drop') {
        if (i + 1 >= rawArgs.length) {
          console.error('Expected value after --drop.');
          process.exit(1);
        }
        const value = Number.parseInt(rawArgs[i + 1], 10);
        if (Number.isNaN(value) || value < 0) {
          console.error('Drop must be zero or a positive integer.');
          process.exit(1);
        }
        drop = value;
        i += 1;
        continue;
      }
      if (arg.startsWith('--sort=')) {
        const value = arg.slice('--sort='.length);
        if (value === 'asc' || value === 'desc' || value === 'none') {
          sort = value;
        } else {
          console.error('Sort must be one of: asc, desc, none.');
          process.exit(1);
        }
        continue;
      }
      if (arg === '--sort') {
        if (i + 1 >= rawArgs.length) {
          console.error('Expected value after --sort.');
          process.exit(1);
        }
        const value = rawArgs[i + 1];
        if (value === 'asc' || value === 'desc' || value === 'none') {
          sort = value;
        } else {
          console.error('Sort must be one of: asc, desc, none.');
          process.exit(1);
        }
        i += 1;
        continue;
      }

      console.warn(`Ignoring unknown argument: ${arg}`);
    }

    const { sets, details } = rollAbilityScores({ seed, count, drop, sort });
    const sortLabel = sort ? sort : 'none';

    console.log(`Ability Scores (4d6 drop lowest, seed=${seed ? `"${seed}"` : 'none'}, sort=${sortLabel})`);
    console.log(`Sets: [${sets.join(', ')}]`);
    const detailStrings = details
      .map((rolls, index) => {
        const total = sets[index];
        return `[${rolls.join(',')}] -> ${total}`;
      })
      .join(', ');
    console.log(`Details per stat: [${detailStrings}]`);
    process.exit(0);
  }

  if (subcommand === 'standard') {
    console.log(`Standard Array: [${standardArray().join(', ')}]`);
    process.exit(0);
  }

  if (subcommand === 'pointbuy') {
    if (rawArgs.length === 0) {
      console.error('Missing ability scores for point buy.');
      showUsage();
      process.exit(1);
    }

    const scores = rawArgs[0]
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
      .map((value) => Number.parseInt(value, 10));

    const result = validatePointBuy(scores);

    if (result.ok) {
      console.log(`Point Buy: OK (cost ${result.cost} / budget ${result.budget})`);
    } else {
      console.log('Point Buy: INVALID');
      result.errors.forEach((message) => {
        console.log(`- ${message}`);
      });
    }
    process.exit(result.ok ? 0 : 1);
  }

  console.error(`Unknown abilities subcommand: ${subcommand}`);
  showUsage();
  process.exit(1);
}

console.error(`Unknown command: ${command}`);
showUsage();
process.exit(1);
