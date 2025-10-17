import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createEncounter } from '../src/encounter.js';
import {
  buildEncounterFromSpec,
  importMonsters,
  readIndex,
  seedBasic,
} from '../../../apps/cli/compendium.js';

describe('compendium seed command', () => {
  let tempDir: string;
  let cwdSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'compendium-seed-test-'));
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
  });

  afterEach(() => {
    cwdSpy.mockRestore();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('writes the basic pack when seeding', async () => {
    const count = await seedBasic();
    expect(count).toBeGreaterThanOrEqual(3);

    const index = await readIndex();
    expect(Object.keys(index)).toEqual(expect.arrayContaining(['goblin', 'skeleton', 'bandit']));
  });

  it('returns a friendly message when the import path is missing', async () => {
    const result = await importMonsters(join(tempDir, 'missing', 'monsters.json'));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("Tip: run 'compendium seed srd-basic' first");
    }
  });

  it('builds encounters using seeded monsters without missing entries', async () => {
    await seedBasic();
    const encounter = createEncounter('seeded');

    const { added, missing } = await buildEncounterFromSpec(encounter, 'goblin x2, skeleton x1', 'foe');
    expect(missing).toEqual([]);
    const names = added.map((actor) => actor.name);
    expect(names).toEqual(expect.arrayContaining(['Goblin #1', 'Goblin #2', 'Skeleton #1']));
  });
});
