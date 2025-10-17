import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ensureLootTableExists,
  listLootTables,
  loadLootTable,
  type LoadedLootTable,
} from '../loot';

function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'loot-tables-'));
}

function writeRawLoot(root: string, name: string, contents: unknown): void {
  const dir = join(root, '.data', 'loot');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${name}.json`), JSON.stringify(contents, null, 2), {
    encoding: 'utf-8',
    flag: 'w',
    mode: 0o666,
  });
}

describe('loot table loader', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('lists no tables when the loot directory is absent', async () => {
    const tables = await listLootTables(tempDir);
    expect(tables).toEqual([]);
  });

  it('returns false for ensureLootTableExists when the file is missing', async () => {
    const exists = await ensureLootTableExists('missing-table', tempDir);
    expect(exists).toBe(false);
  });

  it('loads entries-based loot tables with metadata', async () => {
    writeRawLoot(tempDir, 'entries', {
      name: 'entries',
      rolls: 2,
      entries: [
        { weight: 3, item: { name: 'Arrow', qty: 2 } },
        { weight: 1, item: { type: 'coins', denom: 'Gold', qty: 5 } },
      ],
    });

    const table = (await loadLootTable('entries', tempDir)) as LoadedLootTable;
    expect(table.name).toBe('entries');
    expect(table.rolls).toBe(2);
    expect(table.entries).toHaveLength(2);
    expect(table.__schema).toBe('entries');
    expect(table.__warnings).toStrictEqual([]);
  });

  it('loads rows-based loot tables and converts ranges to weights', async () => {
    writeRawLoot(tempDir, 'legacy', {
      name: 'legacy',
      rolls: 1,
      rows: [
        { range: [1, 10], item: 'String', qty: 1 },
        { min: 11, max: 30, item: { type: 'coins', denom: 'Copper', qty: 6 } },
      ],
    });

    const table = (await loadLootTable('legacy', tempDir)) as LoadedLootTable;
    expect(table.rolls).toBe(1);
    expect(table.__schema).toBe('rows');
    expect(table.entries).toEqual([
      { item: { name: 'String', qty: 1 }, weight: 10 },
      { item: { type: 'coins', denom: 'Copper', qty: 6 }, weight: 20 },
    ]);
    expect(table.__warnings).toStrictEqual([]);
  });
});
