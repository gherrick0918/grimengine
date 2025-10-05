import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SPELL_CACHE_ROOT = join(process.cwd(), '.data', 'cache', 'spells');

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

export function spellCachePath(name: string): string {
  return join(SPELL_CACHE_ROOT, `${slugify(name)}.json`);
}

export function ensureCacheDir(): void {
  mkdirSync(SPELL_CACHE_ROOT, { recursive: true });
}

export function readCachedSpell(name: string): any | null {
  const path = spellCachePath(name);
  if (!existsSync(path)) {
    return null;
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function writeCachedSpell(name: string, json: any): void {
  ensureCacheDir();
  writeFileSync(spellCachePath(name), JSON.stringify(json, null, 2), 'utf8');
}

export function listCachedSpells(): string[] {
  ensureCacheDir();
  try {
    return readdirSync(SPELL_CACHE_ROOT)
      .filter((entry) => entry.toLowerCase().endsWith('.json'))
      .map((entry) => entry.replace(/\.json$/i, ''))
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

export async function fetchSpellFromAPI(name: string): Promise<any> {
  const request = await loadRequest();
  const slug = slugify(name);
  const primaryUrl = `https://www.dnd5eapi.co/api/spells/${slug}`;

  let response = await request(primaryUrl).catch(() => null);
  if (response && response.statusCode === 200) {
    return await response.body.json();
  }

  const searchUrl = `https://www.dnd5eapi.co/api/spells?name=${encodeURIComponent(name)}`;
  response = await request(searchUrl).catch(() => null);
  if (response && response.statusCode === 200) {
    const data: any = await response.body.json();
    const first = data?.results?.[0];
    if (first?.url) {
      const detailUrl = `https://www.dnd5eapi.co${first.url}`;
      const detailResponse = await request(detailUrl).catch(() => null);
      if (detailResponse && detailResponse.statusCode === 200) {
        return await detailResponse.body.json();
      }
    }
  }

  throw new Error(`Spell not found: ${name}`);
}

export interface NormalizedSpell {
  name: string;
  level: number;
  attackType?: 'ranged' | 'melee';
  save?: { ability: 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA'; onSuccess: 'half' | 'none' };
  damageDice?: string;
  damageType?: string;
  damageAtCharacterLevel?: Record<number, string>;
  damageAtSlotLevel?: Record<number, string>;
  dcAbility?: 'INT' | 'WIS' | 'CHA';
  concentration?: boolean;
  info?: {
    range?: string;
    concentration?: boolean;
    ritual?: boolean;
    casting_time?: string;
  };
}

function normalizeScalingRecord(source: unknown): Record<number, string> | undefined {
  if (!source || typeof source !== 'object') {
    return undefined;
  }

  const entries = Object.entries(source as Record<string, unknown>)
    .map(([key, value]) => {
      const level = Number.parseInt(key, 10);
      return Number.isFinite(level) && typeof value === 'string' ? ([level, value] as const) : undefined;
    })
    .filter((entry): entry is readonly [number, string] => Boolean(entry));

  if (entries.length === 0) {
    return undefined;
  }

  const record: Record<number, string> = {};
  for (const [level, dice] of entries) {
    record[level] = dice;
  }
  return record;
}

function extractDamageDice(api: any): { dice?: string; type?: string } {
  const result: { dice?: string; type?: string } = {};

  const damage = api?.damage;
  if (!damage) {
    return result;
  }

  if (damage.damage_at_character_level && typeof damage.damage_at_character_level === 'object') {
    const entries = Object.entries(damage.damage_at_character_level as Record<string, unknown>);
    const sorted = entries
      .filter((entry): entry is [string, string] => typeof entry[0] === 'string' && typeof entry[1] === 'string')
      .sort((a, b) => Number.parseInt(a[0], 10) - Number.parseInt(b[0], 10));
    if (sorted.length > 0) {
      result.dice = sorted[0][1];
    }
  }

  if (!result.dice && Array.isArray(damage.damage)) {
    const first = damage.damage[0];
    if (first && typeof first === 'object') {
      if (typeof first.damage_dice === 'string') {
        result.dice = first.damage_dice;
      }
      if (typeof first.damage_type?.name === 'string') {
        result.type = first.damage_type.name;
      }
    }
  }

  if (!result.dice && typeof damage.damage_dice === 'string') {
    result.dice = damage.damage_dice;
  }

  if (!result.type && typeof damage.damage_type?.name === 'string') {
    result.type = damage.damage_type.name;
  }

  if (!result.dice && damage.damage_at_slot_level && typeof damage.damage_at_slot_level === 'object') {
    const entries = Object.entries(damage.damage_at_slot_level as Record<string, unknown>);
    const sorted = entries
      .filter((entry): entry is [string, string] => typeof entry[0] === 'string' && typeof entry[1] === 'string')
      .sort((a, b) => Number.parseInt(a[0], 10) - Number.parseInt(b[0], 10));
    if (sorted.length > 0) {
      result.dice = sorted[0][1];
    }
  }

  return result;
}

export function normalizeSpell(api: any): NormalizedSpell {
  const level = typeof api?.level === 'number' ? api.level : 0;
  const attackType = api?.attack_type === 'ranged' || api?.attack_type === 'melee' ? api.attack_type : undefined;

  let save: NormalizedSpell['save'];
  const dc = api?.dc;
  if (dc?.dc_type?.name) {
    const abilityName = String(dc.dc_type.name).toUpperCase();
    const ability = (['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const).find((ab) => ab === abilityName);
    if (ability) {
      const onSuccess = dc.dc_success === 'half' ? 'half' : 'none';
      save = { ability, onSuccess };
    }
  }

  const damage = extractDamageDice(api);

  let dcAbility: NormalizedSpell['dcAbility'];
  if (Array.isArray(api?.classes)) {
    const classNames = api.classes
      .map((entry: any) => (typeof entry?.name === 'string' ? entry.name.toLowerCase() : undefined))
      .filter((name: string | undefined): name is string => Boolean(name));
    if (classNames.includes('wizard')) {
      dcAbility = 'INT';
    } else if (classNames.some((name) => ['cleric', 'druid', 'ranger'].includes(name))) {
      dcAbility = 'WIS';
    } else if (classNames.some((name) => ['bard', 'sorcerer', 'warlock', 'paladin'].includes(name))) {
      dcAbility = 'CHA';
    }
  }

  const damageAtCharacterLevel = normalizeScalingRecord(api?.damage?.damage_at_character_level);
  const damageAtSlotLevel = normalizeScalingRecord(api?.damage?.damage_at_slot_level);
  const concentration = Boolean(api?.concentration);

  return {
    name: typeof api?.name === 'string' ? api.name : 'Unknown Spell',
    level,
    attackType,
    save,
    damageDice: damage.dice,
    damageType: damage.type,
    damageAtCharacterLevel,
    damageAtSlotLevel,
    dcAbility,
    concentration,
    info: {
      range: typeof api?.range === 'string' ? api.range : undefined,
      concentration,
      ritual: Boolean(api?.ritual),
      casting_time: typeof api?.casting_time === 'string' ? api.casting_time : undefined,
    },
  };
}

export async function getSpell(name: string): Promise<NormalizedSpell> {
  const cached = readCachedSpell(name);
  if (cached) {
    return normalizeSpell(cached);
  }
  const api = await fetchSpellFromAPI(name);
  writeCachedSpell(name, api);
  return normalizeSpell(api);
}

export { SPELL_CACHE_ROOT as SPELL_CACHE_ROOT_PATH };
