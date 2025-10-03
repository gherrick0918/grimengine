import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { MonsterActor, WeaponProfile } from '@grimengine/core/src/encounter.js';

export const MONSTER_CACHE_ROOT = join(process.cwd(), '.data', 'cache', 'monsters');

type FetchOptions = Parameters<typeof fetch>[1];

type RequestFn = (url: string, options?: Record<string, unknown>) => Promise<{
  statusCode: number;
  body: { json(): Promise<unknown> };
}>;

let cachedRequest: RequestFn | undefined;

async function loadRequest(): Promise<RequestFn> {
  if (!cachedRequest) {
    try {
      const undici = await import('undici');
      cachedRequest = undici.request as RequestFn;
    } catch {
      cachedRequest = async (url: string, options?: Record<string, unknown>) => {
        const response = await fetch(url, options as FetchOptions);
        return {
          statusCode: response.status,
          body: {
            async json() {
              return response.json();
            },
          },
        };
      };
    }
  }
  return cachedRequest;
}

export function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '-');
}

export function cachePath(name: string): string {
  return join(MONSTER_CACHE_ROOT, `${slugify(name)}.json`);
}

export function ensureCacheDir(): void {
  mkdirSync(MONSTER_CACHE_ROOT, { recursive: true });
}

export function readCachedMonster(name: string): any | null {
  const path = cachePath(name);
  if (!existsSync(path)) {
    return null;
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function listCachedMonsters(): string[] {
  ensureCacheDir();
  try {
    return readdirSync(MONSTER_CACHE_ROOT)
      .filter((entry) => entry.toLowerCase().endsWith('.json'))
      .map((entry) => entry.replace(/\.json$/i, ''))
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

export async function fetchMonsterFromAPI(name: string): Promise<any> {
  const request = await loadRequest();
  const slug = slugify(name);
  const url1 = `https://www.dnd5eapi.co/api/monsters/${slug}`;
  let response = await request(url1).catch(() => null);
  if (response && response.statusCode === 200) {
    return await response.body.json();
  }

  const url2 = `https://www.dnd5eapi.co/api/monsters?name=${encodeURIComponent(name)}`;
  response = await request(url2).catch(() => null);
  if (response && response.statusCode === 200) {
    const data = await response.body.json();
    const first = data?.results?.[0];
    if (first?.url) {
      const detailResponse = await request(`https://www.dnd5eapi.co${first.url}`).catch(() => null);
      if (detailResponse && detailResponse.statusCode === 200) {
        return await detailResponse.body.json();
      }
    }
  }

  throw new Error(`Monster not found: ${name}`);
}

export function writeCache(name: string, json: any): void {
  ensureCacheDir();
  writeFileSync(cachePath(name), JSON.stringify(json, null, 2), 'utf8');
}

function abilityScoreToMod(score: number | undefined): number {
  if (typeof score !== 'number') {
    return 0;
  }
  return Math.floor((score - 10) / 2);
}

function normalizeArmorClass(value: any): number {
  if (Array.isArray(value)) {
    const first = value[0];
    if (typeof first === 'number') {
      return first;
    }
    if (first && typeof first === 'object' && 'value' in first) {
      const nested = (first as { value?: number }).value;
      if (typeof nested === 'number') {
        return nested;
      }
    }
    if (first !== undefined) {
      return normalizeArmorClass(first);
    }
  }

  if (typeof value === 'number') {
    return value;
  }

  return 10;
}

function buildWeaponProfile(
  api: any,
  mods: Record<string, number>,
  proficiencyBonus: number,
): WeaponProfile {
  const actions: any[] = Array.isArray(api.actions) ? api.actions : [];
  const firstAttack = actions.find(
    (action) => typeof action?.attack_bonus === 'number' || (Array.isArray(action?.damage) && action.damage.length > 0),
  );

  if (firstAttack) {
    const attackMod =
      typeof firstAttack.attack_bonus === 'number'
        ? firstAttack.attack_bonus
        : (mods.DEX || mods.STR || 0) + proficiencyBonus;
    const damage = Array.isArray(firstAttack.damage) ? firstAttack.damage[0] : undefined;
    const dice = typeof damage?.damage_dice === 'string' && damage.damage_dice.length > 0 ? damage.damage_dice : '1d4';
    const bonus =
      typeof damage?.damage_bonus === 'number'
        ? damage.damage_bonus
        : typeof mods.STR === 'number'
          ? mods.STR
          : 0;
    const signed = bonus >= 0 ? `+${bonus}` : `${bonus}`;

    return {
      name: typeof firstAttack.name === 'string' && firstAttack.name.length > 0 ? firstAttack.name : api.name ?? 'Attack',
      attackMod,
      damageExpr: `${dice}${signed}`,
    };
  }

  const fallbackAbility = (mods.DEX ?? 0) >= (mods.STR ?? 0) ? mods.DEX ?? 0 : mods.STR ?? 0;
  return {
    name: 'Attack',
    attackMod: fallbackAbility + proficiencyBonus,
    damageExpr: `1d4+${fallbackAbility}`,
  };
}

export function normalizeMonster(name: string, api: any): Omit<MonsterActor, 'id' | 'side'> {
  const ac = normalizeArmorClass(api.armor_class);
  const hp = typeof api.hit_points === 'number' ? api.hit_points : 1;

  const abilityMods = {
    STR: abilityScoreToMod(api.strength),
    DEX: abilityScoreToMod(api.dexterity),
    CON: abilityScoreToMod(api.constitution),
    INT: abilityScoreToMod(api.intelligence),
    WIS: abilityScoreToMod(api.wisdom),
    CHA: abilityScoreToMod(api.charisma),
  } as MonsterActor['abilityMods'];

  const proficiencyBonus = typeof api.prof_bonus === 'number' ? api.prof_bonus : 2;
  const attackProfile = buildWeaponProfile(api, abilityMods, proficiencyBonus);

  return {
    type: 'monster',
    name: typeof api.name === 'string' && api.name.length > 0 ? api.name : name,
    ac,
    hp,
    maxHp: hp,
    abilityMods,
    proficiencyBonus,
    attacks: [attackProfile],
  };
}

export async function getMonster(name: string): Promise<Omit<MonsterActor, 'id' | 'side'>> {
  const cached = readCachedMonster(name);
  if (cached) {
    return normalizeMonster(name, cached);
  }

  const api = await fetchMonsterFromAPI(name);
  writeCache(name, api);
  return normalizeMonster(name, api);
}
