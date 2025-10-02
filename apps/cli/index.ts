import {
  abilityCheck,
  roll,
  rollAbilityScores,
  savingThrow,
  standardArray,
  validatePointBuy,
  attackRoll,
  damageRoll,
  resolveAttack,
  type AbilityName,
  type AttackRollResult,
} from '@grimengine/core';

function showUsage(): void {
  console.log('Usage:');
  console.log('  pnpm dev -- roll "<expression>" [adv|dis] [--seed <value>]');
  console.log('  pnpm dev -- check <ability> [modifier] [--dc <n>] [--proficient] [--pb <n>] [--adv|--dis] [--seed <value>]');
  console.log('  pnpm dev -- save <ability> [modifier] [--dc <n>] [--proficient] [--pb <n>] [--adv|--dis] [--seed <value>]');
  console.log('  pnpm dev -- attack [--mod <+n|-n>] [--proficient] [--pb <n>] [--adv|--dis] [--ac <n>] [--seed <value>]');
  console.log('  pnpm dev -- damage "<expression>" [--crit] [--resist] [--vuln] [--seed <value>]');
  console.log(
    '  pnpm dev -- resolve --dmg "<expression>" [--mod <+n|-n>] [--proficient] [--pb <n>] [--adv|--dis] [--ac <n>] [--seed <value>] [--crit] [--resist] [--vuln] [--dmg-seed <value>]'
  );
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

function parseSignedInteger(value: string | undefined, label: string): number {
  if (typeof value !== 'string') {
    throw new Error(`Expected value for ${label}.`);
  }

  const cleaned = value.replace(/^\+/, '');
  const parsed = Number.parseInt(cleaned, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`${label} must be an integer.`);
  }

  return parsed;
}

function getAttackOutcome(attack: AttackRollResult): string | undefined {
  if (attack.isCrit) {
    return 'CRIT!';
  }
  if (attack.isFumble) {
    return 'FUMBLE';
  }
  if (attack.hit === true) {
    return 'HIT';
  }
  if (attack.hit === false) {
    return 'MISS';
  }
  return undefined;
}

function handleAttackCommand(rawArgs: string[]): void {
  let abilityMod = 0;
  let proficient = false;
  let proficiencyBonus: number | undefined;
  let advantage = false;
  let disadvantage = false;
  let targetAC: number | undefined;
  let seed: string | undefined;

  try {
    for (let i = 0; i < rawArgs.length; i += 1) {
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

      if (arg.startsWith('--mod=')) {
        abilityMod = parseSignedInteger(arg.slice('--mod='.length), '--mod');
        continue;
      }

      if (lower === '--mod') {
        abilityMod = parseSignedInteger(rawArgs[i + 1], '--mod');
        i += 1;
        continue;
      }

      if (arg.startsWith('--pb=')) {
        proficiencyBonus = parseSignedInteger(arg.slice('--pb='.length), '--pb');
        continue;
      }

      if (lower === '--pb') {
        proficiencyBonus = parseSignedInteger(rawArgs[i + 1], '--pb');
        i += 1;
        continue;
      }

      if (arg.startsWith('--ac=')) {
        targetAC = parseSignedInteger(arg.slice('--ac='.length), '--ac');
        continue;
      }

      if (lower === '--ac') {
        targetAC = parseSignedInteger(rawArgs[i + 1], '--ac');
        i += 1;
        continue;
      }

      if (arg.startsWith('--seed=')) {
        seed = arg.slice('--seed='.length);
        continue;
      }

      if (lower === '--seed') {
        if (i + 1 >= rawArgs.length) {
          throw new Error('Expected value after --seed.');
        }
        seed = rawArgs[i + 1];
        i += 1;
        continue;
      }

      console.warn(`Ignoring unknown argument: ${arg}`);
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
  }

  if (advantage && disadvantage) {
    console.error('Cannot roll with both advantage and disadvantage.');
    process.exit(1);
  }

  const attack = attackRoll({
    abilityMod,
    proficient,
    proficiencyBonus,
    advantage,
    disadvantage,
    seed,
    targetAC,
  });

  const outcome = getAttackOutcome(attack);

  console.log(`Attack: ${attack.expression}`);
  const rollsLine = `Rolls: [${attack.d20s.join(', ')}] → natural ${attack.natural} → total ${attack.total}`;
  console.log(outcome ? `${rollsLine} → ${outcome}` : rollsLine);
  if (outcome) {
    console.log(`Result: ${outcome}`);
  }

  process.exit(0);
}

function handleDamageCommand(rawArgs: string[]): void {
  if (rawArgs.length === 0) {
    console.error('Missing damage expression.');
    showUsage();
    process.exit(1);
  }

  const [expression, ...rest] = rawArgs;
  let crit = false;
  let resistance = false;
  let vulnerability = false;
  let seed: string | undefined;

  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    const lower = arg.toLowerCase();

    if (lower === '--crit') {
      crit = true;
      continue;
    }

    if (lower === '--resist' || lower === '--resistance') {
      resistance = true;
      continue;
    }

    if (lower === '--vuln' || lower === '--vulnerability') {
      vulnerability = true;
      continue;
    }

    if (arg.startsWith('--seed=')) {
      seed = arg.slice('--seed='.length);
      continue;
    }

    if (lower === '--seed') {
      if (i + 1 >= rest.length) {
        console.error('Expected value after --seed.');
        process.exit(1);
      }
      seed = rest[i + 1];
      i += 1;
      continue;
    }

    console.warn(`Ignoring unknown argument: ${arg}`);
  }

  const result = damageRoll({ expression, crit, resistance, vulnerability, seed });

  console.log(`Damage: ${result.expression}`);
  const parts = [`Rolls: [${result.rolls.join(', ')}]`];
  if (result.critRolls && result.critRolls.length > 0) {
    parts.push(`+ crit [${result.critRolls.join(', ')}]`);
  }
  parts.push(`→ base ${result.baseTotal}`);
  parts.push(`→ final ${result.finalTotal}`);
  console.log(parts.join(' '));

  process.exit(0);
}

function handleResolveCommand(rawArgs: string[]): void {
  let abilityMod = 0;
  let proficient = false;
  let proficiencyBonus: number | undefined;
  let advantage = false;
  let disadvantage = false;
  let targetAC: number | undefined;
  let seed: string | undefined;
  let damageExpression: string | undefined;
  let damageSeed: string | undefined;
  let damageCrit = false;
  let damageResistance = false;
  let damageVulnerability = false;

  try {
    for (let i = 0; i < rawArgs.length; i += 1) {
      const arg = rawArgs[i];
      const lower = arg.toLowerCase();

      if (arg.startsWith('--dmg=')) {
        damageExpression = arg.slice('--dmg='.length);
        continue;
      }

      if (lower === '--dmg') {
        if (i + 1 >= rawArgs.length) {
          throw new Error('Expected value after --dmg.');
        }
        damageExpression = rawArgs[i + 1];
        i += 1;
        continue;
      }

      if (arg.startsWith('--dmg-seed=')) {
        damageSeed = arg.slice('--dmg-seed='.length);
        continue;
      }

      if (lower === '--dmg-seed') {
        if (i + 1 >= rawArgs.length) {
          throw new Error('Expected value after --dmg-seed.');
        }
        damageSeed = rawArgs[i + 1];
        i += 1;
        continue;
      }

      if (lower === '--crit') {
        damageCrit = true;
        continue;
      }

      if (lower === '--resist' || lower === '--resistance') {
        damageResistance = true;
        continue;
      }

      if (lower === '--vuln' || lower === '--vulnerability') {
        damageVulnerability = true;
        continue;
      }

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

      if (arg.startsWith('--mod=')) {
        abilityMod = parseSignedInteger(arg.slice('--mod='.length), '--mod');
        continue;
      }

      if (lower === '--mod') {
        abilityMod = parseSignedInteger(rawArgs[i + 1], '--mod');
        i += 1;
        continue;
      }

      if (arg.startsWith('--pb=')) {
        proficiencyBonus = parseSignedInteger(arg.slice('--pb='.length), '--pb');
        continue;
      }

      if (lower === '--pb') {
        proficiencyBonus = parseSignedInteger(rawArgs[i + 1], '--pb');
        i += 1;
        continue;
      }

      if (arg.startsWith('--ac=')) {
        targetAC = parseSignedInteger(arg.slice('--ac='.length), '--ac');
        continue;
      }

      if (lower === '--ac') {
        targetAC = parseSignedInteger(rawArgs[i + 1], '--ac');
        i += 1;
        continue;
      }

      if (arg.startsWith('--seed=')) {
        seed = arg.slice('--seed='.length);
        continue;
      }

      if (lower === '--seed') {
        if (i + 1 >= rawArgs.length) {
          throw new Error('Expected value after --seed.');
        }
        seed = rawArgs[i + 1];
        i += 1;
        continue;
      }

      console.warn(`Ignoring unknown argument: ${arg}`);
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
  }

  if (!damageExpression) {
    console.error('Missing damage expression. Provide --dmg "<expression>".');
    process.exit(1);
  }

  if (advantage && disadvantage) {
    console.error('Cannot roll with both advantage and disadvantage.');
    process.exit(1);
  }

  const result = resolveAttack({
    abilityMod,
    proficient,
    proficiencyBonus,
    advantage,
    disadvantage,
    seed,
    targetAC,
    damage: {
      expression: damageExpression,
      crit: damageCrit,
      resistance: damageResistance,
      vulnerability: damageVulnerability,
      seed: damageSeed,
    },
  });

  const { attack, damage } = result;
  const outcome = getAttackOutcome(attack);

  console.log(`Attack: ${attack.expression}`);
  const rollsLine = `Rolls: [${attack.d20s.join(', ')}] → natural ${attack.natural} → total ${attack.total}`;
  console.log(outcome ? `${rollsLine} → ${outcome}` : rollsLine);

  if (damage) {
    console.log(`Damage: ${damage.expression}`);
    const parts = [`Rolls: [${damage.rolls.join(', ')}]`];
    if (damage.critRolls && damage.critRolls.length > 0) {
      parts.push(`+ crit [${damage.critRolls.join(', ')}]`);
    }
    parts.push(`→ base ${damage.baseTotal}`);
    parts.push(`→ final ${damage.finalTotal}`);
    console.log(parts.join(' '));
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

if (command === 'attack') {
  handleAttackCommand(rest);
}

if (command === 'damage') {
  handleDamageCommand(rest);
}

if (command === 'resolve') {
  handleResolveCommand(rest);
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
