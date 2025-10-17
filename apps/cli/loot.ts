import { promises as fs } from 'node:fs';
import { join } from 'node:path';

type LootRange = [number, number];

interface LootTableRow {
  range: LootRange;
  item: string;
  qty?: number;
}

interface LootTable {
  name?: string;
  rows: LootTableRow[];
}

export interface LootRollResult {
  roll: number;
  item?: string;
  qty: number;
}

interface LootRollOptions {
  baseDir?: string;
  random?: () => number;
}

interface SeedLootOptions {
  baseDir?: string;
}

function lootDir(baseDir?: string): string {
  return join(baseDir ?? process.cwd(), '.data', 'loot');
}

function lootTablePath(table: string, baseDir?: string): string {
  return join(lootDir(baseDir), `${table}.json`);
}

function rollD100(random: () => number): number {
  const value = random();
  const scaled = Math.floor(value * 100);
  return 1 + Math.min(99, Math.max(0, scaled));
}

function resolveRow(table: LootTable, roll: number): LootTableRow | undefined {
  return table.rows.find((row) => {
    const [min, max] = row.range;
    return roll >= min && roll <= max;
  });
}

export async function lootRoll(table: string, options: LootRollOptions = {}): Promise<LootRollResult> {
  const random = options.random ?? Math.random;
  const filePath = lootTablePath(table, options.baseDir);
  const contents = await fs.readFile(filePath, 'utf-8');
  const parsed = JSON.parse(contents) as LootTable;
  const roll = rollD100(random);
  const row = resolveRow(parsed, roll);
  return {
    roll,
    item: row?.item,
    qty: row?.qty ?? 1,
  };
}

export async function seedLootBasic(options: SeedLootOptions = {}): Promise<string> {
  const filePath = lootTablePath('goblin-pouch', options.baseDir);
  await fs.mkdir(lootDir(options.baseDir), { recursive: true });
  const table: LootTable = {
    name: 'goblin-pouch',
    rows: [
      { range: [1, 50], item: 'Copper coins', qty: 10 },
      { range: [51, 85], item: 'Arrows', qty: 5 },
      { range: [86, 95], item: 'Minor potion', qty: 1 },
      { range: [96, 100], item: 'Gem shard', qty: 1 },
    ],
  };
  await fs.writeFile(filePath, JSON.stringify(table, null, 2), 'utf-8');
  return filePath;
}
