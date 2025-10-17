import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createEncounter, giveToParty, listBag } from '@grimengine/core';
import { lootRoll, seedLootBasic } from '../loot';

describe('loot tables', () => {
  let tempDir: string;
  const tableName = 'test-table';

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'loot-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('rolls a loot table and appends results to the party bag', async () => {
    const lootDir = join(tempDir, '.data', 'loot');
    mkdirSync(lootDir, { recursive: true });
    const tablePath = join(lootDir, `${tableName}.json`);
    const table = {
      name: tableName,
      rows: [
        { range: [1, 40], item: 'Copper coins', qty: 10 },
        { range: [41, 90], item: 'Arrows', qty: 5 },
        { range: [91, 100], item: 'Gem shard', qty: 1 },
      ],
    };
    writeFileSync(tablePath, JSON.stringify(table, null, 2), 'utf-8');

    const encounter = createEncounter('loot-test');
    const result = await lootRoll(tableName, {
      baseDir: tempDir,
      random: () => 0.5,
    });

    expect(result.roll).toBe(51);
    expect(result.item).toBe('Arrows');
    expect(result.qty).toBe(5);

    if (!result.item) {
      throw new Error('Expected item to be defined.');
    }

    giveToParty(encounter, result.item, result.qty);
    expect(listBag(encounter)).toEqual([{ name: 'Arrows', qty: 5 }]);
  });

  it('rejects with ENOENT when a loot table is missing', async () => {
    await expect(lootRoll('missing-table', { baseDir: tempDir })).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('writes a starter loot table when seeding basic tables', async () => {
    const filePath = await seedLootBasic({ baseDir: tempDir });
    const contents = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(contents) as {
      name?: string;
      rows?: Array<{ range: [number, number]; item: string; qty?: number }>;
    };

    expect(filePath).toBe(join(tempDir, '.data', 'loot', 'goblin-pouch.json'));
    expect(parsed.name).toBe('goblin-pouch');
    expect(parsed.rows).toBeDefined();
    const rows = parsed.rows ?? [];
    expect(rows).toContainEqual({ range: [1, 50], item: 'Copper coins', qty: 10 });
  });
});
