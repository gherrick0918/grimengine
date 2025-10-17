import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import {
  LOOT_COIN_DENOMINATIONS,
  rollLoot,
  type EncounterState,
  type LootCoinDenomination,
  type LootEntry,
  type LootItemSpec,
  type LootQty,
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

type LoadedLootTableSchema = 'rows' | 'entries' | 'unknown';

export interface LoadedLootTable extends LootTable {
  __schema?: LoadedLootTableSchema;
  __warnings?: string[];
}

interface LegacyRangeRow {
  range?: unknown;
  min?: unknown;
  max?: unknown;
  start?: unknown;
  end?: unknown;
  item?: unknown;
  qty?: unknown;
}

interface WeightedEntryLike {
  item?: unknown;
  weight?: unknown;
  qty?: unknown;
}

type LootTableJson = {
  name?: unknown;
  rolls?: unknown;
  rows?: unknown;
  entries?: unknown;
};

const VALID_COIN_DENOMS = new Set<string>(
  LOOT_COIN_DENOMINATIONS.map((denom) => denom.toLowerCase()),
);

function normalizeQty(value: unknown): LootQty | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'object' && value && 'dice' in value) {
    const dice = (value as { dice?: unknown }).dice;
    if (typeof dice === 'string' && dice.trim()) {
      return { dice: dice.trim() };
    }
    return undefined;
  }
  if (typeof value === 'string' && value.trim()) {
    return { dice: value.trim() };
  }
  return undefined;
}

function normalizeDenom(value: unknown): LootCoinDenomination | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const lowered = value.trim().toLowerCase();
  if (!VALID_COIN_DENOMS.has(lowered)) {
    return undefined;
  }
  return LOOT_COIN_DENOMINATIONS.find(
    (denom) => denom.toLowerCase() === lowered,
  );
}

function normalizeItemSpec(value: unknown, fallbackQty?: unknown): LootItemSpec | undefined {
  if (typeof value === 'string') {
    const name = value.trim();
    if (!name) {
      return undefined;
    }
    const qty = normalizeQty(fallbackQty);
    return qty === undefined ? { name } : { name, qty };
  }

  if (typeof value === 'object' && value) {
    const source = value as Record<string, unknown>;
    const type = typeof source.type === 'string' ? source.type : undefined;
    const qty = normalizeQty(source.qty ?? fallbackQty);

    if (type === 'coins') {
      const denom = normalizeDenom(source.denom);
      if (!denom) {
        return undefined;
      }
      return qty === undefined
        ? { type: 'coins', denom }
        : { type: 'coins', denom, qty };
    }

    const nameSource = source.name ?? source.item;
    if (typeof nameSource === 'string' && nameSource.trim()) {
      const name = nameSource.trim();
      return qty === undefined ? { name } : { name, qty };
    }
  }

  return undefined;
}

function normalizeRange(row: LegacyRangeRow): [number, number] | undefined {
  const source = row.range;
  if (Array.isArray(source) && source.length >= 2) {
    const start = Number(source[0]);
    const end = Number(source[1]);
    if (Number.isFinite(start) && Number.isFinite(end)) {
      const lo = Math.trunc(Math.min(start, end));
      const hi = Math.trunc(Math.max(start, end));
      return [lo, hi];
    }
  }

  const minLike = row.min ?? row.start;
  const maxLike = row.max ?? row.end;
  if (minLike !== undefined && maxLike !== undefined) {
    const start = Number(minLike);
    const end = Number(maxLike);
    if (Number.isFinite(start) && Number.isFinite(end)) {
      const lo = Math.trunc(Math.min(start, end));
      const hi = Math.trunc(Math.max(start, end));
      return [lo, hi];
    }
  }
  return undefined;
}

function convertRowsToEntries(rows: LegacyRangeRow[], warnings: string[]): LootEntry[] {
  const entries: LootEntry[] = [];
  for (const [index, row] of rows.entries()) {
    const range = normalizeRange(row);
    if (!range) {
      warnings.push(`Row ${index + 1} has an invalid range.`);
      continue;
    }
    const width = Math.max(0, range[1] - range[0] + 1);
    if (width <= 0) {
      warnings.push(`Row ${index + 1} has an empty range.`);
      continue;
    }
    const item = normalizeItemSpec(row.item, row.qty);
    if (!item) {
      warnings.push(`Row ${index + 1} is missing a valid item.`);
      continue;
    }
    entries.push({ item, weight: width });
  }
  return entries;
}

function convertEntries(entries: WeightedEntryLike[], warnings: string[]): LootEntry[] {
  const normalized: LootEntry[] = [];
  for (const [index, entry] of entries.entries()) {
    const item = normalizeItemSpec(entry.item, entry.qty);
    if (!item) {
      warnings.push(`Entry ${index + 1} is missing a valid item.`);
      continue;
    }
    const numericWeight = Number(entry.weight);
    const weight = Number.isFinite(numericWeight) ? numericWeight : 0;
    if (weight <= 0) {
      warnings.push(`Entry ${index + 1} has a non-positive weight.`);
      continue;
    }
    normalized.push({ item, weight });
  }
  return normalized;
}

function parseLootTableJson(tableName: string, raw: LootTableJson): LoadedLootTable {
  const name = typeof raw?.name === 'string' && raw.name.trim() ? raw.name.trim() : tableName;
  const warnings: string[] = [];

  if (Array.isArray(raw?.entries)) {
    const entries = convertEntries(raw.entries as WeightedEntryLike[], warnings);
    const rollsValue = Number(raw.rolls);
    const rolls = Number.isFinite(rollsValue) ? rollsValue : undefined;
    return { name, rolls, entries, __schema: 'entries', __warnings: warnings };
  }

  if (Array.isArray(raw?.rows)) {
    const entries = convertRowsToEntries(raw.rows as LegacyRangeRow[], warnings);
    if (entries.length === 0) {
      warnings.push('No valid rows were found in the loot table.');
    }
    const rollsValue = Number(raw.rolls);
    const rolls = Number.isFinite(rollsValue) && rollsValue > 0 ? rollsValue : 1;
    return { name, rolls, entries, __schema: 'rows', __warnings: warnings };
  }

  warnings.push('Loot table did not contain "rows" or "entries".');
  return { name, rolls: 1, entries: [], __schema: 'unknown', __warnings: warnings };
}

export async function loadLootTable(
  tableName: string,
  baseDir?: string,
): Promise<LoadedLootTable> {
  const path = lootTablePath(tableName, baseDir);
  try {
    const contents = await fs.readFile(path, 'utf-8');
    const parsed = JSON.parse(contents) as LootTableJson;
    return parseLootTableJson(tableName, parsed);
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
  warnings?: string[];
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
  const warnings: string[] = [...(table.__warnings ?? [])];
  if (receiptItems.length === 0 && table.entries.length === 0) {
    warnings.push(`Loot table "${table.name}" has no entries.`);
  }

  return {
    table: table.name,
    target: targetLabel,
    items: receiptItems,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

export async function ensureLootTableExists(tableName: string, baseDir?: string): Promise<boolean> {
  const path = lootTablePath(tableName, baseDir);
  return fileExists(path);
}
