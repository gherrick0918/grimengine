import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createEncounter, type EncounterState } from '@grimengine/core';
import { listEncounterSaves, loadEncounterByName, saveEncounterAs } from '../enc-session';

const SNAPSHOT_NAME = 'hm-demo';

let originalCwd: string;
let workspaceDir: string;

function buildSampleEncounter(): EncounterState {
  const encounter = createEncounter('seed-123');
  encounter.round = 2;
  encounter.turnIndex = 1;
  encounter.order = [
    { actorId: 'bruni', rolled: 15, total: 18 },
    { actorId: 'goblin-1', rolled: 12, total: 14 },
  ];
  encounter.actors = {
    bruni: {
      id: 'bruni',
      name: 'Bruni',
      side: 'party',
      ac: 17,
      hp: 27,
      maxHp: 27,
      abilityMods: { WIS: 3 },
      proficiencyBonus: 3,
      type: 'pc',
      defaultWeapon: { name: 'Warhammer', attackMod: 6, damageExpr: '1d8+4' },
      tags: [
        {
          id: 't1',
          text: 'Bless (+d4 to attacks and saves)',
          source: 'Bruni',
          key: 'spell',
          value: 'bless',
          addedAtRound: 1,
        },
      ],
    },
    'goblin-1': {
      id: 'goblin-1',
      name: 'Goblin #1',
      side: 'foe',
      ac: 15,
      hp: 7,
      maxHp: 7,
      abilityMods: { DEX: 2 },
      type: 'monster',
      attacks: [{ name: 'Scimitar', attackMod: 4, damageExpr: '1d6+2' }],
      tags: [
        {
          id: 't2',
          text: "Hunter's Mark",
          source: 'Kara',
          key: 'spell',
          value: 'hunters-mark',
          addedAtRound: 1,
        },
      ],
    },
  };
  encounter.concentration = {
    bruni: {
      casterId: 'bruni',
      spellName: 'Bless',
      targetIds: ['bruni', 'kara'],
    },
  };
  encounter.defeated = new Set(['goblin-2']);
  return encounter;
}

beforeAll(() => {
  originalCwd = process.cwd();
  workspaceDir = mkdtempSync(join(tmpdir(), 'grim-cli-'));
  process.chdir(workspaceDir);
});

afterAll(() => {
  process.chdir(originalCwd);
  rmSync(workspaceDir, { recursive: true, force: true });
});

beforeEach(() => {
  rmSync(join(workspaceDir, '.data'), { recursive: true, force: true });
});

describe('encounter snapshots', () => {
  it('persists encounter details, tags, and concentration to disk', () => {
    const encounter = buildSampleEncounter();

    const filePath = saveEncounterAs(SNAPSHOT_NAME, encounter);
    const contents = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(contents) as any;

    expect(parsed.round).toBe(2);
    expect(parsed.turnIndex).toBe(1);
    expect(parsed).toHaveProperty('actors');
    const actors = parsed.actors as Record<string, any>;
    expect(actors.bruni.tags[0].key).toBe('spell');
    expect(actors['goblin-1'].tags[0].value).toBe('hunters-mark');
    expect(parsed).toHaveProperty('concentration');
    const concentration = parsed.concentration as Record<string, any>;
    expect(concentration.bruni.spellName).toBe('Bless');
    expect(concentration.bruni.targetIds).toEqual(['bruni', 'kara']);
    expect(parsed).toHaveProperty('defeated');
    expect(parsed.defeated).toEqual(['goblin-2']);
  });

  it('restores a saved snapshot and lists available saves', () => {
    const encounter = buildSampleEncounter();
    encounter.round = 5;
    encounter.turnIndex = 2;
    encounter.defeated = new Set(['goblin-2', 'goblin-3']);

    saveEncounterAs(SNAPSHOT_NAME, encounter);

    expect(listEncounterSaves()).toEqual([SNAPSHOT_NAME]);

    const loaded = loadEncounterByName(SNAPSHOT_NAME);
    expect(loaded).not.toBeNull();
    expect(loaded?.round).toBe(5);
    expect(loaded?.turnIndex).toBe(2);
    expect(loaded?.defeated instanceof Set).toBe(true);
    expect(loaded?.defeated.has('goblin-3')).toBe(true);
    expect(loaded?.actors['goblin-1'].name).toBe('Goblin #1');
    expect(loaded?.concentration?.bruni?.spellName).toBe('Bless');
  });
});
