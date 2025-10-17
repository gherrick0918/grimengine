import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import {
  LOOT_COIN_DENOMINATIONS,
  rollLoot,
  type EncounterState,
  type LootCoinDenomination,
  type LootTable,
  type RolledLootItem,
  giveToParty,
  giveToActor,
} from '@grimengine/core';

function lootDir(baseDir?: string): string {
  return join(baseDir ?? process.cwd(), '.data', 'loot');
}

function lootTablePath(tableName: string, baseDir?: string): string {
  return join(lootDir(baseDir), `${tableName}.json`);
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

export class LootTableNotFoundError extends Error {
  constructor(
    public readonly table: string,
    public readonly available: string[],
  ) {
    super(`Loot table not found: ${table}`);
    this.name = 'LootTableNotFoundError';
  }
}

export async function listLootTables(baseDir?: string): Promise<string[]> {
  const dir = lootDir(baseDir);
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map((entry) => entry.name.replace(/\.json$/i, ''))
      .sort();
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err?.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

export async function loadLootTable(tableName: string, baseDir?: string): Promise<LootTable> {
  const path = lootTablePath(tableName, baseDir);
  try {
    const contents = await fs.readFile(path, 'utf-8');
    const parsed = JSON.parse(contents) as LootTable;
    return { ...parsed, name: parsed.name ?? tableName };
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err?.code === 'ENOENT') {
      const available = await listLootTables(baseDir);
      throw new LootTableNotFoundError(tableName, available);
    }
    throw error;
  }
}

function aggregateLoot(items: RolledLootItem[]): RolledLootItem[] {
  const order: RolledLootItem[] = [];
  const seen = new Map<string, RolledLootItem>();

  for (const entry of items) {
    if (!entry || entry.qty === 0) {
      continue;
    }
    const key =
      entry.kind === 'coins'
        ? `coins:${entry.denom}`
        : `item:${entry.name.trim().toLowerCase()}`;
    const existing = seen.get(key);
    if (existing) {
      existing.qty += entry.qty;
      continue;
    }
    const clone: RolledLootItem =
      entry.kind === 'coins'
        ? { kind: 'coins', denom: entry.denom, qty: entry.qty }
        : { kind: 'item', name: entry.name, qty: entry.qty };
    seen.set(key, clone);
    order.push(clone);
  }

  return order.filter((entry) => entry.qty !== 0);
}

function coinLabel(denom: LootCoinDenomination): string {
  return `${denom} coins`;
}

const VALID_DENOMS = new Set<LootCoinDenomination>(LOOT_COIN_DENOMINATIONS);

export interface RollLootIntoEncounterOptions {
  baseDir?: string;
  random?: () => number;
  seed?: string;
  into?: 'party' | { actorId: string; label: string };
}

export interface LootReceiptItem {
  kind: RolledLootItem['kind'];
  label: string;
  qty: number;
  denom?: LootCoinDenomination;
  name?: string;
}

export interface LootReceipt {
  table: string;
  target: string;
  items: LootReceiptItem[];
}

function applyLoot(
  encounter: EncounterState,
  aggregated: RolledLootItem[],
  target: RollLootIntoEncounterOptions['into'],
): LootReceiptItem[] {
  const items: LootReceiptItem[] = [];

  for (const entry of aggregated) {
    if (entry.qty === 0) {
      continue;
    }
    let label: string;
    if (entry.kind === 'coins') {
      if (!VALID_DENOMS.has(entry.denom)) {
        continue;
      }
      label = coinLabel(entry.denom);
      if (target === 'party') {
        giveToParty(encounter, label, entry.qty);
      } else if (target) {
        giveToActor(encounter, target.actorId, label, entry.qty);
      }
      items.push({ kind: 'coins', label, qty: entry.qty, denom: entry.denom });
    } else {
      label = entry.name;
      if (target === 'party') {
        giveToParty(encounter, label, entry.qty);
      } else if (target) {
        giveToActor(encounter, target.actorId, label, entry.qty);
      }
      items.push({ kind: 'item', label, qty: entry.qty, name: entry.name });
    }
  }

  return items;
}

export async function rollLootIntoEncounter(
  tableName: string,
  encounter: EncounterState,
  options: RollLootIntoEncounterOptions = {},
): Promise<LootReceipt> {
  const table = await loadLootTable(tableName, options.baseDir);
  const rolled = rollLoot(table, { random: options.random, seed: options.seed });
  const aggregated = aggregateLoot(rolled);
  const target = options.into ?? 'party';
  const receiptItems = applyLoot(encounter, aggregated, target);
  const targetLabel = target === 'party' ? 'party bag' : target.label;

  return {
    table: table.name,
    target: targetLabel,
    items: receiptItems,
  };
}

export async function ensureLootTableExists(tableName: string, baseDir?: string): Promise<boolean> {
  const path = lootTablePath(tableName, baseDir);
  return fileExists(path);
}
