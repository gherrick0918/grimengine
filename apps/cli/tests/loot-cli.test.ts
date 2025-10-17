import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  addActor,
  createEncounter,
  listBag,
  listInv,
  type EncounterState,
  type LootTable,
  type PlayerActor,
} from '@grimengine/core';
import { LootTableNotFoundError, rollLootIntoEncounter } from '../loot';

function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'loot-cli-'));
}

function ensureLootDir(root: string): string {
  const dir = join(root, '.data', 'loot');
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeLootTable(root: string, table: Record<string, unknown> & { name: string }): void {
  const dir = ensureLootDir(root);
  const path = join(dir, `${table.name}.json`);
  writeFileSync(path, JSON.stringify(table, null, 2), 'utf-8');
}

function sequenceRng(values: number[]): () => number {
  let index = 0;
  return () => {
    const value = values[index] ?? values[values.length - 1] ?? 0;
    index += 1;
    return value;
  };
}

function createPc(id: string, name: string): PlayerActor {
  return {
    id,
    name,
    type: 'pc',
    side: 'party',
    ac: 12,
    hp: 10,
    maxHp: 10,
    abilityMods: {},
  };
}

describe('loot command helpers', () => {
  let tempDir: string;
  let encounter: EncounterState;

  beforeEach(() => {
    tempDir = createTempDir();
    encounter = createEncounter('loot-test');
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('deposits rolled loot into the party bag by default', async () => {
    const table: LootTable = {
      name: 'goblin-pouch',
      rolls: 2,
      entries: [
        { weight: 1, item: { type: 'coins', denom: 'Copper', qty: 7 } },
        { weight: 1, item: { name: 'Arrows', qty: 3 } },
      ],
    };
    writeLootTable(tempDir, table);

    const rng = sequenceRng([0.1, 0.9]);
    const receipt = await rollLootIntoEncounter('goblin-pouch', encounter, {
      baseDir: tempDir,
      random: rng,
    });

    expect(receipt.table).toBe('goblin-pouch');
    expect(receipt.target).toBe('party bag');
    expect(receipt.items).toEqual([
      { kind: 'coins', label: 'Copper coins', qty: 7, denom: 'Copper' },
      { kind: 'item', label: 'Arrows', qty: 3, name: 'Arrows' },
    ]);
    expect(listBag(encounter)).toEqual([
      { name: 'Copper coins', qty: 7 },
      { name: 'Arrows', qty: 3 },
    ]);

    await rollLootIntoEncounter('goblin-pouch', encounter, {
      baseDir: tempDir,
      random: sequenceRng([0.1, 0.9]),
    });

    expect(listBag(encounter)).toEqual([
      { name: 'Copper coins', qty: 14 },
      { name: 'Arrows', qty: 6 },
    ]);
  });

  it('can deposit loot into a named actor inventory', async () => {
    const table: LootTable = {
      name: 'coin-cache',
      entries: [{ weight: 1, item: { type: 'coins', denom: 'Gold', qty: 5 } }],
    };
    writeLootTable(tempDir, table);

    const pc = createPc('pc-1', 'Kara');
    encounter = addActor(encounter, pc);

    const receipt = await rollLootIntoEncounter('coin-cache', encounter, {
      baseDir: tempDir,
      into: { actorId: pc.id, label: pc.name },
      random: () => 0.2,
    });

    expect(receipt.target).toBe('Kara');
    expect(receipt.items).toEqual([{ kind: 'coins', label: 'Gold coins', qty: 5, denom: 'Gold' }]);
    expect(listInv(encounter, pc.id)).toEqual([{ name: 'Gold coins', qty: 5 }]);
  });

  it('supports legacy rows-based loot tables', async () => {
    const table = {
      name: 'legacy-pouch',
      rows: [
        { range: [1, 60], item: 'Old Button', qty: 2 },
        { range: [61, 100], item: { type: 'coins', denom: 'Silver', qty: 4 } },
      ],
    };
    writeLootTable(tempDir, table);

    const rng = sequenceRng([0.2, 0.8]);

    const first = await rollLootIntoEncounter('legacy-pouch', encounter, {
      baseDir: tempDir,
      random: rng,
    });
    expect(first.items).toEqual([{ kind: 'item', label: 'Old Button', qty: 2, name: 'Old Button' }]);
    expect(listBag(encounter)).toEqual([{ name: 'Old Button', qty: 2 }]);

    const second = await rollLootIntoEncounter('legacy-pouch', encounter, {
      baseDir: tempDir,
      random: rng,
    });
    expect(second.items).toEqual([
      { kind: 'coins', label: 'Silver coins', qty: 4, denom: 'Silver' },
    ]);
    expect(listBag(encounter)).toEqual([
      { name: 'Old Button', qty: 2 },
      { name: 'Silver coins', qty: 4 },
    ]);
  });

  it('throws a descriptive error when the loot table is missing', async () => {
    const table: LootTable = {
      name: 'goblin-pouch',
      entries: [{ weight: 1, item: { name: 'String', qty: 1 } }],
    };
    writeLootTable(tempDir, table);

    await expect(
      rollLootIntoEncounter('missing-table', encounter, { baseDir: tempDir }),
    ).rejects.toBeInstanceOf(LootTableNotFoundError);

    try {
      await rollLootIntoEncounter('missing-table', encounter, { baseDir: tempDir });
    } catch (error) {
      if (error instanceof LootTableNotFoundError) {
        expect(error.table).toBe('missing-table');
        expect(error.available).toEqual(['goblin-pouch']);
      } else {
        throw error;
      }
    }
  });
});
