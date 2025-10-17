import { promises as fs } from 'node:fs';
import { join, relative } from 'node:path';
import type { LootTable } from '@grimengine/core';

const root = process.cwd();
const lootDir = join(root, '.data', 'loot');

const TABLE_TEMPLATES: LootTable[] = [
  {
    name: 'goblin-pouch',
    rolls: 1,
    entries: [
      { item: { type: 'coins', denom: 'Copper', qty: { dice: '3d6' } }, weight: 5 },
      { item: { type: 'coins', denom: 'Silver', qty: { dice: '1d6' } }, weight: 3 },
      { item: { name: 'Arrows', qty: { dice: '1d4' } }, weight: 4 },
      { item: { name: 'Tinderbox', qty: 1 }, weight: 1 },
      { item: { name: 'String (50 ft)', qty: 1 }, weight: 1 },
    ],
  },
  {
    name: 'bandit-pouch',
    rolls: 1,
    entries: [
      { item: { type: 'coins', denom: 'Silver', qty: { dice: '2d6' } }, weight: 4 },
      { item: { type: 'coins', denom: 'Gold', qty: { dice: '1d6' } }, weight: 2 },
      { item: { name: 'Dagger', qty: 1 }, weight: 3 },
      { item: { name: 'Playing Cards', qty: 1 }, weight: 1 },
    ],
  },
  {
    name: 'common-trinkets',
    rolls: 1,
    entries: [
      { item: { name: 'Feather Charm', qty: 1 }, weight: 2 },
      { item: { name: 'Glass Bead', qty: { dice: '1d4' } }, weight: 2 },
      { item: { name: 'Twine Bundle', qty: 1 }, weight: 2 },
      { item: { name: 'Tiny Bell', qty: 1 }, weight: 1 },
      { item: { name: 'Wooden Button', qty: { dice: '1d6' } }, weight: 1 },
    ],
  },
];

async function ensureDir(): Promise<void> {
  await fs.mkdir(lootDir, { recursive: true });
}

async function seedTable(table: LootTable): Promise<boolean> {
  const path = join(lootDir, `${table.name}.json`);
  try {
    await fs.access(path);
    return false;
  } catch {
    const contents = JSON.stringify(table, null, 2);
    await fs.writeFile(path, contents, 'utf-8');
    console.log(`Seeded ${table.name} -> ${relative(root, path)}`);
    return true;
  }
}

async function main(): Promise<void> {
  await ensureDir();
  let created = 0;
  for (const table of TABLE_TEMPLATES) {
    if (await seedTable(table)) {
      created += 1;
    }
  }
  if (created === 0) {
    console.log('All starter loot tables already exist.');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
