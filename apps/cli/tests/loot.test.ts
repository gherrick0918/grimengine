import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createEncounter, giveToParty, listBag } from '@grimengine/core';
import { lootRoll } from '../loot';

describe('loot tables', () => {
  let tempDir: string;
  const tableName = 'test-table';

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'loot-test-'));
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
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('rolls a loot table and appends results to the party bag', async () => {
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
});
