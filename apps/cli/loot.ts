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
  const baseDir = options.baseDir ?? process.cwd();
  const random = options.random ?? Math.random;
  const filePath = join(baseDir, '.data', 'loot', `${table}.json`);
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
