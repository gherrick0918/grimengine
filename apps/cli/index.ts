import { roll } from '@grimengine/core';

function showUsage(): void {
  console.log('Usage: pnpm dev -- roll "<expression>" [adv|dis] [--seed <value>]');
}

const [, , ...argv] = process.argv;
const [command, ...rawArgs] = argv[0] === '--' ? argv.slice(1) : argv;

if (!command || command === 'help' || command === '--help') {
  showUsage();
  process.exit(0);
}

if (command !== 'roll') {
  console.error(`Unknown command: ${command}`);
  showUsage();
  process.exit(1);
}

if (rawArgs.length === 0) {
  console.error('Missing dice expression.');
  showUsage();
  process.exit(1);
}

const expression = rawArgs[0];
let advantage = false;
let disadvantage = false;
let seed: string | undefined;

for (let i = 1; i < rawArgs.length; i += 1) {
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
