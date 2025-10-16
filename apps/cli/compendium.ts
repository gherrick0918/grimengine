import { promises as fs } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type { EncounterState, MonsterActor, Side, WeaponProfile } from '@grimengine/core';
import { addActor as addEncounterActor } from '@grimengine/core';
import { normalizeMonster } from '../../packages/adapters/dnd5e-api/src/monsters.js';
import { MONSTERS } from '../../packages/adapters/rules-srd/src/monsters.js';

export interface MonsterIndex {
  [slug: string]: any;
}

const FILE = join(process.cwd(), '.data', 'compendium', 'monsters.json');

export function slugifyName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export async function readIndex(): Promise<MonsterIndex> {
  try {
    const contents = await fs.readFile(FILE, 'utf-8');
    return JSON.parse(contents) as MonsterIndex;
  } catch {
    return {};
  }
}

export async function writeIndex(index: MonsterIndex): Promise<void> {
  const directory = dirname(FILE);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(FILE, `${JSON.stringify(index, null, 2)}\n`, 'utf-8');
}

export async function seedBasic(): Promise<number> {
  const index = await readIndex();
  const pack: MonsterIndex = {
    goblin: {
      slug: 'goblin',
      name: 'Goblin',
      armor_class: 15,
      hit_points: 7,
      prof_bonus: 2,
      strength: 8,
      dexterity: 14,
      constitution: 10,
      intelligence: 10,
      wisdom: 8,
      charisma: 8,
      actions: [
        {
          name: 'Scimitar',
          attack_bonus: 4,
          damage: [
            {
              damage_dice: '1d6',
              damage_bonus: 2,
            },
          ],
        },
      ],
    },
    skeleton: {
      slug: 'skeleton',
      name: 'Skeleton',
      armor_class: 13,
      hit_points: 13,
      prof_bonus: 2,
      strength: 10,
      dexterity: 14,
      constitution: 15,
      intelligence: 6,
      wisdom: 8,
      charisma: 5,
      actions: [
        {
          name: 'Shortsword',
          attack_bonus: 4,
          damage: [
            {
              damage_dice: '1d6',
              damage_bonus: 2,
            },
          ],
        },
      ],
    },
    bandit: {
      slug: 'bandit',
      name: 'Bandit',
      armor_class: 12,
      hit_points: 11,
      prof_bonus: 2,
      strength: 11,
      dexterity: 12,
      constitution: 12,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
      actions: [
        {
          name: 'Scimitar',
          attack_bonus: 3,
          damage: [
            {
              damage_dice: '1d6',
              damage_bonus: 1,
            },
          ],
        },
      ],
    },
  };
  const nextIndex = { ...index, ...pack };
  await writeIndex(nextIndex);
  return Object.keys(nextIndex).length;
}

async function resolveJsonFiles(srcPath: string): Promise<string[]> {
  const stat = await fs.stat(srcPath);
  if (stat.isDirectory()) {
    const entries = await fs.readdir(srcPath);
    return entries
      .filter((entry) => entry.toLowerCase().endsWith('.json'))
      .map((entry) => resolve(srcPath, entry));
  }
  return [srcPath];
}

function extractSlug(monster: any, fallback: string): string | undefined {
  const fromObject = typeof monster?.slug === 'string' && monster.slug.trim().length > 0 ? monster.slug : undefined;
  const fromName = typeof monster?.name === 'string' && monster.name.trim().length > 0 ? monster.name : undefined;
  const base = fromObject ?? fromName ?? fallback;
  const slug = slugifyName(base);
  return slug.length > 0 ? slug : undefined;
}

export async function importMonsters(
  srcPath: string,
): Promise<{ ok: true; count: number } | { ok: false; message: string }> {
  try {
    const index = await readIndex();
    const files = await resolveJsonFiles(srcPath);

    for (const file of files) {
      const contents = await fs.readFile(file, 'utf-8');
      const monster = JSON.parse(contents);
      const slug = extractSlug(monster, file);
      if (!slug) {
        continue;
      }
      index[slug] = monster;
    }

    await writeIndex(index);
    return { ok: true, count: Object.keys(index).length };
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return {
        ok: false,
        message: "Import path not found. Tip: run 'compendium seed srd-basic' first or provide a valid SRD path.",
      };
    }
    throw error;
  }
}

function findCompendiumEntry(index: MonsterIndex, query: string): any | undefined {
  const slug = slugifyName(query);
  if (slug && index[slug]) {
    return index[slug];
  }
  const lower = query.trim().toLowerCase();
  return Object.values(index).find((entry) => typeof entry?.name === 'string' && entry.name.trim().toLowerCase() === lower);
}

const FALLBACK_BY_SLUG: Record<string, Omit<MonsterActor, 'id' | 'side'>> = Object.fromEntries(
  MONSTERS.map((monster) => [slugifyName(monster.name), monster]),
);

const FALLBACK_BY_NAME: Record<string, Omit<MonsterActor, 'id' | 'side'>> = Object.fromEntries(
  MONSTERS.map((monster) => [monster.name.toLowerCase(), monster]),
);

function cloneWeaponProfile(profile: WeaponProfile): WeaponProfile {
  return { ...profile };
}

function cloneMonsterTemplate(template: Omit<MonsterActor, 'id' | 'side'>): Omit<MonsterActor, 'id' | 'side'> {
  return {
    ...template,
    abilityMods: { ...template.abilityMods },
    attacks: template.attacks.map(cloneWeaponProfile),
  };
}

export function resolveCompendiumTemplate(index: MonsterIndex, query: string): Omit<MonsterActor, 'id' | 'side'> | undefined {
  const entry = findCompendiumEntry(index, query);
  if (entry) {
    const name = typeof entry?.name === 'string' && entry.name.trim().length > 0 ? entry.name : query;
    return normalizeMonster(name, entry);
  }
  const slug = slugifyName(query);
  if (slug && FALLBACK_BY_SLUG[slug]) {
    return cloneMonsterTemplate(FALLBACK_BY_SLUG[slug]);
  }
  const fallback = FALLBACK_BY_NAME[query.trim().toLowerCase()];
  if (fallback) {
    return cloneMonsterTemplate(fallback);
  }
  return undefined;
}

export function parseEncounterSpec(spec: string): Array<{ name: string; count: number }> {
  return spec
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => {
      const match = part.match(/(.+?)\s+x(\d+)/i);
      if (match) {
        return { name: match[1].trim(), count: Number.parseInt(match[2], 10) || 1 };
      }
      return { name: part, count: 1 };
    });
}

function slugifyId(value: string): string {
  const cleaned = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return cleaned.length > 0 ? cleaned : 'actor';
}

export function generateActorId(state: EncounterState, base: string): string {
  const slug = slugifyId(base);
  if (!state.actors[slug]) {
    return slug;
  }
  let index = 2;
  while (state.actors[`${slug}-${index}`]) {
    index += 1;
  }
  return `${slug}-${index}`;
}

function nextMonsterNumber(state: EncounterState, baseName: string): number {
  const pattern = new RegExp(`^${baseName.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')} #([0-9]+)$`, 'i');
  let highest = 0;
  Object.values(state.actors).forEach((actor) => {
    const match = actor.name.match(pattern);
    if (match) {
      const value = Number.parseInt(match[1], 10);
      if (Number.isFinite(value) && value > highest) {
        highest = value;
      }
    }
  });
  return highest + 1;
}

function cloneMonster(
  template: Omit<MonsterActor, 'id' | 'side'>,
  id: string,
  name: string,
  side: Side,
): MonsterActor {
  return {
    ...template,
    id,
    name,
    side,
    abilityMods: { ...template.abilityMods },
    attacks: template.attacks.map(cloneWeaponProfile),
  };
}

export function addMonsters(
  state: EncounterState,
  template: Omit<MonsterActor, 'id' | 'side'>,
  baseName: string,
  count: number,
  side: Side = 'foe',
): { state: EncounterState; added: MonsterActor[] } {
  const added: MonsterActor[] = [];
  let nextState = state;
  let nextNumber = nextMonsterNumber(state, baseName);

  for (let i = 0; i < count; i += 1) {
    const name = `${baseName} #${nextNumber}`;
    const id = generateActorId(nextState, name);
    const actor = cloneMonster(template, id, name, side);
    nextState = addEncounterActor(nextState, actor);
    added.push(actor);
    nextNumber += 1;
  }

  return { state: nextState, added };
}

export interface EncounterBuildResult {
  state: EncounterState;
  added: MonsterActor[];
  missing: string[];
}

export async function buildEncounterFromSpec(
  encounter: EncounterState,
  spec: string,
  side: Side,
  options: { index?: MonsterIndex } = {},
): Promise<EncounterBuildResult> {
  const { index: providedIndex } = options;
  const index = providedIndex ?? (await readIndex());
  const entries = parseEncounterSpec(spec);

  let state = encounter;
  const added: MonsterActor[] = [];
  const missing: string[] = [];

  for (const entry of entries) {
    const template = resolveCompendiumTemplate(index, entry.name);
    if (!template) {
      missing.push(entry.name);
      continue;
    }
    const baseName = template.name ?? entry.name;
    const { state: nextState, added: newActors } = addMonsters(state, template, baseName, entry.count, side);
    state = nextState;
    added.push(...newActors);
  }

  return { state, added, missing };
}

export function summarizeTemplate(template: Omit<MonsterActor, 'id' | 'side'>): { name: string; ac: number; hp: number } {
  const name = template.name;
  const ac = typeof template.ac === 'number' ? template.ac : 0;
  const hp = typeof template.maxHp === 'number' ? template.maxHp : template.hp;
  return { name, ac, hp };
}
