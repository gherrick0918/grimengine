import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createEncounter } from '../src/encounter.js';
import {
  buildEncounterFromSpec,
  importMonsters,
  readIndex,
  resolveCompendiumTemplate,
  writeIndex,
} from '../../../apps/cli/compendium.js';

describe('compendium encounter builder', () => {
  let tempDir: string;
  let cwdSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'compendium-test-'));
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
  });

  afterEach(() => {
    cwdSpy.mockRestore();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('imports monsters from directories and files with generated slugs', async () => {
    const sourceDir = join(tempDir, 'srd');
    mkdirSync(sourceDir, { recursive: true });

    writeFileSync(
      join(sourceDir, 'dire-wolf.json'),
      JSON.stringify({ slug: 'dire-wolf', name: 'Dire Wolf', armor_class: 14, hit_points: 37 }, null, 2),
    );
    writeFileSync(
      join(sourceDir, 'goblin-raider.json'),
      JSON.stringify({ name: 'Goblin Raider', armor_class: 15, hit_points: 11 }, null, 2),
    );

    const dirResult = await importMonsters(sourceDir);
    expect(dirResult).toEqual({ ok: true, count: 2 });

    const singlePath = join(tempDir, 'captain.json');
    writeFileSync(singlePath, JSON.stringify({ name: 'Bandit Captain', armor_class: 15, hit_points: 65 }, null, 2));

    const finalResult = await importMonsters(singlePath);
    expect(finalResult).toEqual({ ok: true, count: 3 });

    const index = await readIndex();
    expect(Object.keys(index)).toEqual(expect.arrayContaining(['dire-wolf', 'goblin-raider', 'bandit-captain']));
  });

  it('builds encounters from compendium specs with numbering and side assignment', async () => {
    await writeIndex({
      wolf: {
        name: 'Wolf',
        armor_class: 13,
        hit_points: 11,
        strength: 12,
        dexterity: 15,
      },
    });

    const encounter = createEncounter('build-test');
    const result = await buildEncounterFromSpec(encounter, 'wolf x1, goblin x3', 'foe');

    expect(result.missing).toEqual([]);
    expect(result.added).toHaveLength(4);

    const names = Object.values(result.state.actors).map((actor) => actor.name);
    expect(names).toEqual(expect.arrayContaining(['Wolf #1', 'Goblin #1', 'Goblin #2', 'Goblin #3']));
    result.added.forEach((actor) => {
      expect(actor.side).toBe('foe');
    });
  });

  it('falls back to builtin templates when compendium entry is missing', async () => {
    await writeIndex({});
    const encounter = createEncounter('fallback-test');

    const result = await buildEncounterFromSpec(encounter, 'skeleton x1, mystery x1', 'neutral');

    expect(result.added).toHaveLength(1);
    expect(result.added[0]?.name).toBe('Skeleton #1');
    expect(result.added[0]?.side).toBe('neutral');
    expect(result.missing).toEqual(['mystery']);

    const index = await readIndex();
    expect(resolveCompendiumTemplate(index, 'skeleton')).toBeTruthy();
  });
});
