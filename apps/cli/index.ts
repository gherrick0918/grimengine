import { readFileSync } from 'node:fs';

import {
  abilityCheck,
  roll,
  rollAbilityScores,
  savingThrow,
  standardArray,
  validatePointBuy,
  attackRoll,
  damageRoll,
  resolveAttack,
  chooseAttackAbility,
  resolveWeaponAttack,
  abilityMods,
  proficiencyBonusForLevel,
  characterAbilityCheck,
  characterSavingThrow,
  characterSkillCheck,
  characterWeaponAttack,
  setCharacterWeaponLookup,
  setCharacterArmorData,
  isProficientSave,
  isProficientSkill,
  skillAbility,
  hasExpertise,
  passivePerception,
  derivedAC,
  derivedMaxHP,
  derivedDefaultWeaponProfile,
  SKILL_ABILITY,
  createEncounter,
  addActor as addEncounterActor,
  removeActor as removeEncounterActor,
  rollInitiative as rollEncounterInitiative,
  nextTurn as encounterNextTurn,
  currentActor as encounterCurrentActor,
  actorAttack as encounterActorAttack,
  recordLoot as encounterRecordLoot,
  recordXP as encounterRecordXP,
  rollCoinsForCR,
  totalXP,
  type EncounterState,
  type Actor as EncounterActor,
  type PlayerActor,
  type MonsterActor,
  type WeaponProfile,
  type AbilityName,
  type AttackRollResult,
  type AbilityMods,
  type Proficiencies,
  type Weapon,
  type Character,
  type SkillName,
  type CoinBundle,
} from '@grimengine/core';
import { WEAPONS, getWeaponByName } from '@grimengine/rules-srd/weapons';
import { getArmorByName, SHIELD } from '@grimengine/rules-srd/armor';
import { getMonsterByName } from '@grimengine/rules-srd/monsters';
import { randomSimpleItem } from '@grimengine/rules-srd/loot';
import {
  cachePath as monsterCachePath,
  getMonster as fetchMonster,
  listCachedMonsters,
  readCachedMonster,
} from '@grimengine/dnd5e-api/monsters.js';
import { clearEncounter, loadEncounter, saveEncounter } from './encounterSession';
import { deleteEncounterByName, listEncounterSaves, loadEncounterByName, saveEncounterAs } from './enc-session';
import { clearCharacter, loadCharacter, saveCharacter } from './session';
import { listVaultNames, loadFromVault, saveToVault } from './char-vault';

function showUsage(): void {
  console.log('Usage:');
  console.log('  pnpm dev -- roll "<expression>" [adv|dis] [--seed <value>]');
  console.log('  pnpm dev -- check <ability> [modifier] [--dc <n>] [--proficient] [--pb <n>] [--adv|--dis] [--seed <value>]');
  console.log('  pnpm dev -- save <ability> [modifier] [--dc <n>] [--proficient] [--pb <n>] [--adv|--dis] [--seed <value>]');
  console.log('  pnpm dev -- attack [--mod <+n|-n>] [--proficient] [--pb <n>] [--adv|--dis] [--ac <n>] [--seed <value>]');
  console.log('  pnpm dev -- damage "<expression>" [--crit] [--resist] [--vuln] [--seed <value>]');
  console.log(
    '  pnpm dev -- resolve --dmg "<expression>" [--mod <+n|-n>] [--proficient] [--pb <n>] [--adv|--dis] [--ac <n>] [--seed <value>] [--crit] [--resist] [--vuln] [--dmg-seed <value>]' 
  );
  console.log('  pnpm dev -- abilities roll [--seed <value>] [--count <n>] [--drop <n>] [--sort asc|desc|none]');
  console.log('  pnpm dev -- abilities standard');
  console.log('  pnpm dev -- abilities pointbuy "<comma-separated scores>"');
  console.log('  pnpm dev -- weapon list');
  console.log('  pnpm dev -- weapon info "<name>"');
  console.log(
    '  pnpm dev -- weapon attack "<name>" [--str <n>] [--dex <n>] [--pb <n>] [--profs <simple|martial|comma list>] [--twohanded] [--adv|--dis] [--ac <n>] [--seed <value>]'
  );
  console.log('  pnpm dev -- monster fetch "<name>"');
  console.log('  pnpm dev -- monster list');
  console.log('  pnpm dev -- monster show "<name>"');
  console.log('  pnpm dev -- character load "<path.json>"');
  console.log('  pnpm dev -- character load-name "<name>"');
  console.log('  pnpm dev -- character show');
  console.log('  pnpm dev -- character derive');
  console.log('  pnpm dev -- character check <ability> [--dc <n>] [--adv|--dis] [--seed <value>] [--extraMod <n>]');
  console.log('  pnpm dev -- character save <ability> [--dc <n>] [--adv|--dis] [--seed <value>]');
  console.log('  pnpm dev -- character save --name "<name>"');
  console.log('  pnpm dev -- character skill "<SkillName>" [--dc <n>] [--adv|--dis] [--seed <value>] [--extraMod <n>]');
  console.log('  pnpm dev -- character skills');
  console.log('  pnpm dev -- character list');
  console.log('  pnpm dev -- character attack "<name>" [--twohanded] [--ac <n>] [--adv|--dis] [--seed <value>]');
  console.log('  pnpm dev -- character equip [--armor "<ArmorName>"] [--shield on|off] [--weapon "<WeaponName>"] [--hitdie d6|d8|d10|d12]');
  console.log('  pnpm dev -- character set [--level <n>]');
  console.log('  pnpm dev -- character add-xp <n>');
  console.log('  pnpm dev -- character unload');
  console.log('  pnpm dev -- encounter start [--seed <value>]');
  console.log('  pnpm dev -- encounter add pc "<name>"');
  console.log('  pnpm dev -- encounter add monster "<name>" [--count <n>]');
  console.log('  pnpm dev -- encounter list');
  console.log('  pnpm dev -- encounter save "<name>"');
  console.log('  pnpm dev -- encounter list-saves');
  console.log('  pnpm dev -- encounter load "<name>"');
  console.log('  pnpm dev -- encounter delete "<name>"');
  console.log('  pnpm dev -- encounter roll-init');
  console.log('  pnpm dev -- encounter next');
  console.log('  pnpm dev -- encounter attack "<attacker>" "<defender>" [--adv|--dis] [--twohanded] [--seed <value>]');
  console.log('  pnpm dev -- encounter loot [--seed <value>] [--items <n>] [--note "<text>"]');
  console.log('  pnpm dev -- encounter xp [--party <n>]');
  console.log('  pnpm dev -- encounter end');
}

const ABILITY_NAMES: AbilityName[] = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
const SKILL_NAMES = Object.keys(SKILL_ABILITY) as SkillName[];

function isAbilityName(value: string): value is AbilityName {
  return ABILITY_NAMES.includes(value as AbilityName);
}

function normalizeSkillName(raw: string): SkillName | undefined {
  const target = raw.trim().toLowerCase();
  return SKILL_NAMES.find((skill) => skill.toLowerCase() === target);
}

setCharacterWeaponLookup(getWeaponByName);
setCharacterArmorData(getArmorByName, SHIELD.bonusAC);

function requireEncounterState(): EncounterState {
  const encounter = loadEncounter();
  if (!encounter) {
    console.error('No encounter in progress. Use `pnpm dev -- encounter start` first.');
    process.exit(1);
  }
  return encounter;
}

function slugifyId(value: string): string {
  const cleaned = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return cleaned.length > 0 ? cleaned : 'actor';
}

function generateActorId(state: EncounterState, base: string): string {
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

function formatDamageExpression(base: string, modifier: number): string {
  if (modifier > 0) {
    return `${base}+${modifier}`;
  }
  if (modifier < 0) {
    return `${base}${modifier}`;
  }
  return base;
}

type DefaultWeaponSource = 'equipped' | 'fallback';

interface DefaultWeaponInfo {
  profile: WeaponProfile;
  source: DefaultWeaponSource;
}

function resolveDefaultWeaponInfo(character: Character, mods: AbilityMods, pb: number): DefaultWeaponInfo {
  const derived = derivedDefaultWeaponProfile(character);
  if (derived) {
    const profile: WeaponProfile = { ...derived };
    return { profile, source: 'equipped' };
  }

  const strMod = mods.STR ?? 0;
  const profile: WeaponProfile = {
    name: 'Unarmed',
    attackMod: strMod + pb,
    damageExpr: formatDamageExpression('1d4', strMod),
  };
  return { profile, source: 'fallback' };
}

function formatDefaultWeapon(profile: WeaponProfile, source: DefaultWeaponSource): string {
  const parts: string[] = [profile.name];
  if (source === 'fallback') {
    parts.push('(fallback)');
  }
  const details: string[] = [`to-hit ${formatModifier(profile.attackMod)}`, `damage ${profile.damageExpr}`];
  if (profile.versatileExpr) {
    details.push(`versatile ${profile.versatileExpr}`);
  }
  return `${parts.join(' ')} (${details.join('; ')})`;
}

function cloneWeaponProfile(profile: WeaponProfile): WeaponProfile {
  return { ...profile };
}

function cloneMonster(template: Omit<MonsterActor, 'id' | 'side'>, id: string, name: string): MonsterActor {
  return {
    ...template,
    id,
    name,
    side: 'foe',
    abilityMods: { ...template.abilityMods },
    attacks: template.attacks.map((attack) => cloneWeaponProfile(attack)),
  };
}

function formatHitPoints(actor: EncounterActor): string {
  return `${actor.hp}/${actor.maxHp}`;
}

function findActorByIdentifier(state: EncounterState, identifier: string): EncounterActor {
  const direct = state.actors[identifier];
  if (direct) {
    return direct;
  }

  const matches = Object.values(state.actors).filter(
    (actor) => actor.name.toLowerCase() === identifier.toLowerCase(),
  );

  if (matches.length === 1) {
    return matches[0];
  }

  if (matches.length === 0) {
    throw new Error(`No actor matches "${identifier}".`);
  }

  throw new Error(`Multiple actors match "${identifier}". Use the actor id instead.`);
}

function sortActorsForListing(state: EncounterState): EncounterActor[] {
  return Object.values(state.actors).sort((a, b) => {
    if (a.side !== b.side) {
      return a.side === 'party' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
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

function formatActorLine(state: EncounterState, actor: EncounterActor, currentId: string | undefined): string {
  const pointer = currentId === actor.id ? '→' : ' ';
  const defeated = state.defeated.has(actor.id) ? ' [DEFEATED]' : '';
  const initiative = state.order.find((entry) => entry.actorId === actor.id);
  const initLabel = initiative ? ` init=${initiative.total} (roll ${initiative.rolled})` : '';
  return `${pointer} [${actor.side}] ${actor.name} (id=${actor.id}) AC ${actor.ac} HP ${formatHitPoints(actor)}${defeated}${initLabel}`;
}

function buildPlayerActor(state: EncounterState, name: string, character: Character): PlayerActor {
  const mods = abilityMods(character.abilities);
  const pb = proficiencyBonusForLevel(character.level);
  const id = generateActorId(state, name);
  const ac = derivedAC(character);
  const maxHp = derivedMaxHP(character);
  const { profile: defaultWeapon } = resolveDefaultWeaponInfo(character, mods, pb);

  return {
    id,
    name,
    side: 'party',
    type: 'pc',
    ac,
    hp: maxHp,
    maxHp,
    abilityMods: mods,
    proficiencyBonus: pb,
    defaultWeapon,
  };
}

function addMonsters(
  state: EncounterState,
  template: Omit<MonsterActor, 'id' | 'side'>,
  baseName: string,
  count: number,
): { state: EncounterState; added: MonsterActor[] } {
  const added: MonsterActor[] = [];
  let nextState = state;
  let nextNumber = nextMonsterNumber(state, baseName);

  for (let i = 0; i < count; i += 1) {
    const name = `${baseName} #${nextNumber}`;
    const id = generateActorId(nextState, name);
    const actor = cloneMonster(template, id, name);
    nextState = addEncounterActor(nextState, actor);
    added.push(actor);
    nextNumber += 1;
  }

  return { state: nextState, added };
}

function parseModifier(value: string | undefined): number {
  if (!value) {
    return 0;
  }

  if (value.startsWith('--')) {
    return 0;
  }

  const cleaned = value.replace(/^\+/, '');
  const parsed = Number.parseInt(cleaned, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid modifier: ${value}`);
  }
  return parsed;
}

function formatModifier(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`;
}

function formatMonsterAttack(attack: WeaponProfile | undefined): string {
  if (!attack) {
    return 'No attack profile available.';
  }
  const toHit = formatModifier(attack.attackMod);
  const versatile = attack.versatileExpr ? ` (versatile ${attack.versatileExpr})` : '';
  return `${attack.name} (${toHit}) → ${attack.damageExpr}${versatile}`;
}

function formatWeaponProperties(weapon: Weapon): string {
  const properties = weapon.properties;
  if (!properties) {
    return 'none';
  }

  const parts: string[] = [];

  if (properties.finesse) parts.push('finesse');
  if (properties.light) parts.push('light');
  if (properties.heavy) parts.push('heavy');
  if (properties.reach) parts.push('reach');
  if (properties.twoHanded) parts.push('two-handed');
  if (properties.ammunition) parts.push('ammunition');
  if (properties.loading) parts.push('loading');

  if (properties.thrown) {
    if (properties.thrown === true) {
      parts.push('thrown');
    } else {
      const { normal, long } = properties.thrown;
      const rangeLabel = long ? `${normal}/${long}` : `${normal}`;
      parts.push(`thrown (${rangeLabel})`);
    }
  }

  return parts.length > 0 ? parts.join(', ') : 'none';
}

const FRACTION_CR_VALUES: { value: number; label: string }[] = [
  { value: 0, label: '0' },
  { value: 0.125, label: '1/8' },
  { value: 0.25, label: '1/4' },
  { value: 0.5, label: '1/2' },
];

function normalizeMonsterBaseName(name: string): string {
  return name.replace(/\s+#\d+$/i, '').trim() || name;
}

function formatChallengeRating(value: unknown): string | undefined {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  if (typeof value === 'number') {
    for (const entry of FRACTION_CR_VALUES) {
      if (Math.abs(value - entry.value) < 1e-6) {
        return entry.label;
      }
    }
    if (Number.isInteger(value)) {
      return value.toString();
    }
    return value.toString();
  }
  return undefined;
}

function challengeRatingFromCache(name: string): string | undefined {
  const cached = readCachedMonster(name);
  if (cached && typeof cached === 'object' && 'challenge_rating' in cached) {
    return formatChallengeRating((cached as { challenge_rating?: unknown }).challenge_rating);
  }
  return undefined;
}

function defeatedMonstersWithCR(state: EncounterState): { actor: MonsterActor; cr: string; baseName: string }[] {
  const DEFAULT_CR = '1/2';
  const entries: { actor: MonsterActor; cr: string; baseName: string }[] = [];
  Object.values(state.actors).forEach((actor) => {
    if (actor.type === 'monster' && state.defeated.has(actor.id)) {
      const baseName = normalizeMonsterBaseName(actor.name);
      const cr = challengeRatingFromCache(baseName) ?? DEFAULT_CR;
      entries.push({ actor, cr, baseName });
    }
  });
  return entries;
}

function formatCoinBundle(coins: CoinBundle): string {
  const parts = (
    [
      { key: 'pp', label: 'pp' },
      { key: 'gp', label: 'gp' },
      { key: 'sp', label: 'sp' },
      { key: 'cp', label: 'cp' },
    ] as const
  )
    .filter(({ key }) => coins[key] > 0)
    .map(({ key, label }) => `${coins[key]} ${label}`);
  return parts.length > 0 ? parts.join(', ') : 'none';
}

function requireLoadedCharacter(): Character {
  const character = loadCharacter();
  if (!character) {
    console.error('No character loaded. Use `pnpm dev -- character load "<path.json>"` first.');
    process.exit(1);
  }
  return character;
}

function formatShieldValue(value: boolean): string {
  return value ? 'on' : 'off';
}

function printDerivedStats(character: Character): void {
  const mods = abilityMods(character.abilities);
  const pb = proficiencyBonusForLevel(character.level);
  const ac = derivedAC(character);
  const maxHp = derivedMaxHP(character);
  const hitDie = character.equipped?.hitDie ?? 'd8';
  const hitDieLabel = character.equipped?.hitDie ? hitDie : `${hitDie} (default)`;
  const weaponInfo = resolveDefaultWeaponInfo(character, mods, pb);

  console.log('Derived:');
  console.log(`  AC: ${ac}    Max HP: ${maxHp} (Hit Die ${hitDieLabel})`);
  console.log(`  Default Weapon: ${formatDefaultWeapon(weaponInfo.profile, weaponInfo.source)}`);

  if (!character.equipped?.hitDie) {
    console.log('  Note: No hit die specified; defaulting to d8.');
  }

  if (weaponInfo.source === 'fallback') {
    if (character.equipped?.weapon) {
      console.log(`  Note: Equipped weapon "${character.equipped.weapon}" not found; using fallback Unarmed.`);
    } else {
      console.log('  Note: No weapon equipped; using fallback Unarmed.');
    }
  }
}

function handleCharacterLoadCommand(path: string | undefined): void {
  if (!path) {
    console.error('Missing character file path.');
    process.exit(1);
  }

  try {
    const contents = readFileSync(path, 'utf8');
    const data = JSON.parse(contents);

    if (!data || typeof data !== 'object') {
      throw new Error('Character file must contain a JSON object.');
    }

    const abilitiesRaw = (data as { abilities?: Record<string, unknown> }).abilities ?? {};
    const normalizeScore = (ability: AbilityName): number => {
      const value = Number(abilitiesRaw[ability]);
      if (!Number.isFinite(value)) {
        throw new Error(`Ability ${ability} must be a number.`);
      }
      return value;
    };

    const character: Character = {
      name: String((data as { name?: unknown }).name ?? 'Unnamed'),
      level: Number((data as { level?: unknown }).level ?? 1),
      abilities: {
        STR: normalizeScore('STR'),
        DEX: normalizeScore('DEX'),
        CON: normalizeScore('CON'),
        INT: normalizeScore('INT'),
        WIS: normalizeScore('WIS'),
        CHA: normalizeScore('CHA'),
      },
      proficiencies: (data as { proficiencies?: Character['proficiencies'] }).proficiencies,
    };

    const xpRaw = (data as { xp?: unknown }).xp;
    if (xpRaw !== undefined) {
      const xpValue = Number(xpRaw);
      if (!Number.isFinite(xpValue) || xpValue < 0) {
        throw new Error('Character xp must be a non-negative number when provided.');
      }
      character.xp = Math.floor(xpValue);
    }

    const equippedRaw = (data as { equipped?: unknown }).equipped;
    if (equippedRaw !== undefined) {
      if (equippedRaw === null || typeof equippedRaw !== 'object' || Array.isArray(equippedRaw)) {
        throw new Error('Character equipped section must be an object if provided.');
      }

      const equipped: NonNullable<Character['equipped']> = {};
      const record = equippedRaw as Record<string, unknown>;

      if (record.armor !== undefined) {
        if (typeof record.armor !== 'string') {
          throw new Error('Character equipped.armor must be a string when provided.');
        }
        equipped.armor = record.armor;
      }

      if (record.shield !== undefined) {
        if (typeof record.shield !== 'boolean') {
          throw new Error('Character equipped.shield must be a boolean when provided.');
        }
        equipped.shield = record.shield;
      }

      if (record.weapon !== undefined) {
        if (typeof record.weapon !== 'string') {
          throw new Error('Character equipped.weapon must be a string when provided.');
        }
        equipped.weapon = record.weapon;
      }

      if (record.hitDie !== undefined) {
        if (typeof record.hitDie !== 'string') {
          throw new Error('Character equipped.hitDie must be a string when provided.');
        }
        if (!['d6', 'd8', 'd10', 'd12'].includes(record.hitDie)) {
          throw new Error('Character equipped.hitDie must be one of d6, d8, d10, or d12.');
        }
        equipped.hitDie = record.hitDie as NonNullable<Character['equipped']>['hitDie'];
      }

      if (Object.keys(equipped as Record<string, unknown>).length > 0) {
        character.equipped = equipped;
      }
    }

    const pb = proficiencyBonusForLevel(character.level);
    saveCharacter(character);
    console.log(`Loaded character ${character.name} (lvl ${character.level}). PB ${formatModifier(pb)}`);
    process.exit(0);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Failed to load character: ${error.message}`);
    } else {
      console.error('Failed to load character.');
    }
    process.exit(1);
  }
}

function handleCharacterShowCommand(): void {
  const character = requireLoadedCharacter();
  const pb = proficiencyBonusForLevel(character.level);
  const mods = abilityMods(character.abilities);

  console.log(`${character.name} (level ${character.level})`);
  const xpTotal = character.xp ?? 0;
  console.log(`XP: ${xpTotal}`);
  console.log(`Proficiency Bonus: ${formatModifier(pb)}`);
  console.log('Ability Scores:');
  ABILITY_NAMES.forEach((ability) => {
    const score = character.abilities[ability];
    const modifier = mods[ability];
    console.log(`  ${ability}: ${score} (${formatModifier(modifier)})`);
  });

  const weaponProfs = character.proficiencies?.weapons;
  const weaponParts: string[] = [];
  if (weaponProfs?.simple) weaponParts.push('simple');
  if (weaponProfs?.martial) weaponParts.push('martial');
  console.log(`Weapon Proficiencies: ${weaponParts.length > 0 ? weaponParts.join(', ') : 'none'}`);

  const saveProfs = character.proficiencies?.saves ?? [];
  console.log(`Saving Throws: ${saveProfs.length > 0 ? saveProfs.join(', ') : 'none'}`);

  const skillProfs = character.proficiencies?.skills ?? [];
  console.log(`Skills: ${skillProfs.length > 0 ? skillProfs.join(', ') : 'none'}`);

  console.log(`Passive Perception: ${passivePerception(character)}`);

  console.log('');
  printDerivedStats(character);

  process.exit(0);
}

function handleCharacterDeriveCommand(): void {
  const character = requireLoadedCharacter();
  printDerivedStats(character);
  process.exit(0);
}

function handleCharacterSkillsCommand(): void {
  console.log('Skills:');
  SKILL_NAMES.forEach((skill) => {
    console.log(`- ${skill} (${SKILL_ABILITY[skill]})`);
  });
  process.exit(0);
}

function handleCharacterSkillCommand(rawArgs: string[]): void {
  if (rawArgs.length === 0) {
    console.error('Missing skill name for character skill check.');
    process.exit(1);
  }

  const skillName = normalizeSkillName(rawArgs[0]);
  if (!skillName) {
    console.error(`Unknown skill: ${rawArgs[0]}`);
    console.error('Use `pnpm dev -- character skills` to list available skills.');
    process.exit(1);
  }

  const character = requireLoadedCharacter();

  let dc: number | undefined;
  let advantage = false;
  let disadvantage = false;
  let seed: string | undefined;
  let extraMod = 0;

  for (let i = 1; i < rawArgs.length; i += 1) {
    const arg = rawArgs[i];
    const lower = arg.toLowerCase();

    if (lower === '--adv' || lower === '--advantage') {
      advantage = true;
      continue;
    }

    if (lower === '--dis' || lower === '--disadvantage' || lower === '--disadv') {
      disadvantage = true;
      continue;
    }

    if (arg.startsWith('--dc=')) {
      dc = parseSignedInteger(arg.slice('--dc='.length), '--dc');
      continue;
    }

    if (lower === '--dc') {
      dc = parseSignedInteger(rawArgs[i + 1], '--dc');
      i += 1;
      continue;
    }

    if (arg.startsWith('--seed=')) {
      seed = arg.slice('--seed='.length);
      continue;
    }

    if (lower === '--seed') {
      if (i + 1 >= rawArgs.length) {
        console.error('Expected value after --seed.');
        process.exit(1);
      }
      seed = rawArgs[i + 1];
      i += 1;
      continue;
    }

    if (arg.startsWith('--extramod=')) {
      extraMod = parseSignedInteger(arg.slice('--extramod='.length), '--extraMod');
      continue;
    }

    if (lower === '--extramod') {
      extraMod = parseSignedInteger(rawArgs[i + 1], '--extraMod');
      i += 1;
      continue;
    }

    console.warn(`Ignoring unknown argument: ${arg}`);
  }

  if (advantage && disadvantage) {
    console.error('Cannot roll with both advantage and disadvantage.');
    process.exit(1);
  }

  const result = characterSkillCheck(character, skillName, {
    dc,
    advantage,
    disadvantage,
    seed,
    extraMod,
  });

  const ability = skillAbility(skillName);
  const mods = abilityMods(character.abilities);
  const baseMod = mods[ability] ?? 0;
  const proficient = isProficientSkill(character, skillName);
  const expertise = hasExpertise(character, skillName);
  const pb = proficiencyBonusForLevel(character.level);
  const pbBonus = proficient ? (expertise ? pb * 2 : pb) : 0;
  const modifierParts = [`base ${formatModifier(baseMod)}`];
  if (pbBonus !== 0) {
    modifierParts.push(`PB ${formatModifier(pbBonus)}`);
  }
  if (extraMod !== 0) {
    modifierParts.push(`extra ${formatModifier(extraMod)}`);
  }

  const advLabel = advantage ? ' adv' : disadvantage ? ' dis' : '';
  const dcLabel = typeof dc === 'number' ? ` vs DC ${dc}` : '';
  console.log(`Skill Check: ${skillName} (${ability})${advLabel}${dcLabel}`.trim());
  console.log(`Mods: ${modifierParts.join(', ')}`);
  console.log(`Rolls: [${result.rolls.join(', ')}] → total ${result.total}`);
  if (typeof result.success === 'boolean') {
    console.log(`Result: ${result.success ? 'SUCCESS' : 'FAILURE'}`);
  } else {
    console.log(`Result: ${result.total}`);
  }

  process.exit(0);
}

function handleCharacterCheckCommand(rawArgs: string[]): void {
  if (rawArgs.length === 0) {
    console.error('Missing ability for character check.');
    process.exit(1);
  }

  const abilityRaw = rawArgs[0].toUpperCase();
  if (!isAbilityName(abilityRaw)) {
    console.error(`Invalid ability name: ${rawArgs[0]}`);
    process.exit(1);
  }
  const ability = abilityRaw as AbilityName;
  const character = requireLoadedCharacter();

  let dc: number | undefined;
  let advantage = false;
  let disadvantage = false;
  let seed: string | undefined;
  let extraMod = 0;

  for (let i = 1; i < rawArgs.length; i += 1) {
    const arg = rawArgs[i];
    const lower = arg.toLowerCase();

    if (lower === '--adv' || lower === '--advantage') {
      advantage = true;
      continue;
    }

    if (lower === '--dis' || lower === '--disadvantage' || lower === '--disadv') {
      disadvantage = true;
      continue;
    }

    if (arg.startsWith('--dc=')) {
      dc = parseSignedInteger(arg.slice('--dc='.length), '--dc');
      continue;
    }

    if (lower === '--dc') {
      dc = parseSignedInteger(rawArgs[i + 1], '--dc');
      i += 1;
      continue;
    }

    if (arg.startsWith('--seed=')) {
      seed = arg.slice('--seed='.length);
      continue;
    }

    if (lower === '--seed') {
      if (i + 1 >= rawArgs.length) {
        console.error('Expected value after --seed.');
        process.exit(1);
      }
      seed = rawArgs[i + 1];
      i += 1;
      continue;
    }

    if (arg.startsWith('--extramod=')) {
      extraMod = parseSignedInteger(arg.slice('--extramod='.length), '--extraMod');
      continue;
    }

    if (lower === '--extramod') {
      extraMod = parseSignedInteger(rawArgs[i + 1], '--extraMod');
      i += 1;
      continue;
    }

    console.warn(`Ignoring unknown argument: ${arg}`);
  }

  if (advantage && disadvantage) {
    console.error('Cannot roll with both advantage and disadvantage.');
    process.exit(1);
  }

  const result = characterAbilityCheck(character, ability, {
    dc,
    advantage,
    disadvantage,
    seed,
    extraMod,
  });

  const mods = abilityMods(character.abilities);
  const baseMod = mods[ability];
  const modifierParts = [`base ${formatModifier(baseMod)}`];
  if (extraMod !== 0) {
    modifierParts.push(`extra ${formatModifier(extraMod)}`);
  }

  const advLabel = advantage ? ' adv' : disadvantage ? ' dis' : '';
  const dcLabel = typeof dc === 'number' ? ` vs DC ${dc}` : '';
  console.log(`Ability Check: ${ability}${advLabel}${dcLabel}`.trim());
  console.log(`Mods: ${modifierParts.join(', ')}`);
  console.log(`Rolls: [${result.rolls.join(', ')}] → total ${result.total}`);
  if (typeof result.success === 'boolean') {
    console.log(`Result: ${result.success ? 'SUCCESS' : 'FAILURE'}`);
  } else {
    console.log(`Result: ${result.total}`);
  }

  process.exit(0);
}

function handleCharacterSaveCommand(rawArgs: string[]): void {
  if (rawArgs.length === 0) {
    console.error('Missing arguments for character save.');
    process.exit(1);
  }

  const firstArg = rawArgs[0];
  if (firstArg.toLowerCase() === '--name' || firstArg.toLowerCase().startsWith('--name=')) {
    let name: string | undefined;
    if (firstArg.includes('=')) {
      name = firstArg.slice(firstArg.indexOf('=') + 1).trim();
    } else {
      if (rawArgs.length < 2) {
        console.error('Expected value after --name.');
        process.exit(1);
      }
      name = rawArgs[1];
    }

    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      console.error('Character name is required for vault save.');
      process.exit(1);
    }

    const character = requireLoadedCharacter();
    saveToVault(trimmedName, character);
    console.log(`Saved character "${trimmedName}" to vault.`);
    process.exit(0);
  }

  if (rawArgs.length === 0) {
    console.error('Missing ability for character save.');
    process.exit(1);
  }

  const abilityRaw = rawArgs[0].toUpperCase();
  if (!isAbilityName(abilityRaw)) {
    console.error(`Invalid ability name: ${rawArgs[0]}`);
    process.exit(1);
  }
  const ability = abilityRaw as AbilityName;
  const character = requireLoadedCharacter();

  let dc: number | undefined;
  let advantage = false;
  let disadvantage = false;
  let seed: string | undefined;

  for (let i = 1; i < rawArgs.length; i += 1) {
    const arg = rawArgs[i];
    const lower = arg.toLowerCase();

    if (lower === '--adv' || lower === '--advantage') {
      advantage = true;
      continue;
    }

    if (lower === '--dis' || lower === '--disadvantage' || lower === '--disadv') {
      disadvantage = true;
      continue;
    }

    if (arg.startsWith('--dc=')) {
      dc = parseSignedInteger(arg.slice('--dc='.length), '--dc');
      continue;
    }

    if (lower === '--dc') {
      dc = parseSignedInteger(rawArgs[i + 1], '--dc');
      i += 1;
      continue;
    }

    if (arg.startsWith('--seed=')) {
      seed = arg.slice('--seed='.length);
      continue;
    }

    if (lower === '--seed') {
      if (i + 1 >= rawArgs.length) {
        console.error('Expected value after --seed.');
        process.exit(1);
      }
      seed = rawArgs[i + 1];
      i += 1;
      continue;
    }

    console.warn(`Ignoring unknown argument: ${arg}`);
  }

  if (advantage && disadvantage) {
    console.error('Cannot roll with both advantage and disadvantage.');
    process.exit(1);
  }

  const result = characterSavingThrow(character, ability, {
    dc,
    advantage,
    disadvantage,
    seed,
  });

  const mods = abilityMods(character.abilities);
  const baseMod = mods[ability];
  const proficient = isProficientSave(character, ability);
  const pb = proficient ? proficiencyBonusForLevel(character.level) : 0;
  const modifierParts = [`base ${formatModifier(baseMod)}`];
  if (pb !== 0) {
    modifierParts.push(`PB ${formatModifier(pb)}`);
  }

  const advLabel = advantage ? ' adv' : disadvantage ? ' dis' : '';
  const dcLabel = typeof dc === 'number' ? ` vs DC ${dc}` : '';
  console.log(`Saving Throw: ${ability}${advLabel}${dcLabel}`.trim());
  console.log(`Mods: ${modifierParts.join(', ')}`);
  console.log(`Rolls: [${result.rolls.join(', ')}] → total ${result.total}`);
  if (typeof result.success === 'boolean') {
    console.log(`Result: ${result.success ? 'SUCCESS' : 'FAILURE'}`);
  } else {
    console.log(`Result: ${result.total}`);
  }

  process.exit(0);
}

function handleCharacterVaultListCommand(): void {
  const names = listVaultNames();
  if (names.length === 0) {
    console.log('No saved characters.');
  } else {
    console.log(`Characters: ${names.join(', ')}`);
  }
  process.exit(0);
}

function handleCharacterVaultLoadCommand(name: string | undefined): void {
  if (!name) {
    console.error('Missing character name for load-name command.');
    process.exit(1);
  }

  const trimmedName = name.trim();
  if (trimmedName.length === 0) {
    console.error('Character name cannot be empty.');
    process.exit(1);
  }

  const character = loadFromVault(trimmedName);
  if (!character) {
    console.error(`No saved character named "${trimmedName}".`);
    process.exit(1);
  }

  saveCharacter(character);
  const pb = proficiencyBonusForLevel(character.level);
  console.log(`Loaded character ${character.name} (lvl ${character.level}). PB ${formatModifier(pb)}`);
  process.exit(0);
}

type HitDieValue = NonNullable<Character['equipped']>['hitDie'];

function handleCharacterEquipCommand(rawArgs: string[]): void {
  if (rawArgs.length === 0) {
    console.error('Provide at least one option to update equipment.');
    process.exit(1);
  }

  const character = requireLoadedCharacter();
  const next: Character = { ...character };
  const equipped = { ...(character.equipped ?? {}) } as NonNullable<Character['equipped']>;

  let armorName: string | undefined;
  let shieldValue: boolean | undefined;
  let weaponName: string | undefined;
  let hitDie: HitDieValue | undefined;

  for (let i = 0; i < rawArgs.length; i += 1) {
    const arg = rawArgs[i];
    const lower = arg.toLowerCase();

    if (lower.startsWith('--armor=')) {
      armorName = arg.slice('--armor='.length).trim();
      continue;
    }

    if (lower === '--armor') {
      if (i + 1 >= rawArgs.length) {
        console.error('Expected value after --armor.');
        process.exit(1);
      }
      armorName = rawArgs[i + 1].trim();
      i += 1;
      continue;
    }

    if (lower === '--shield') {
      if (i + 1 < rawArgs.length && !rawArgs[i + 1].startsWith('--')) {
        const value = rawArgs[i + 1].toLowerCase();
        if (value === 'on' || value === 'true') {
          shieldValue = true;
          i += 1;
          continue;
        }
        if (value === 'off' || value === 'false') {
          shieldValue = false;
          i += 1;
          continue;
        }
      }
      shieldValue = true;
      continue;
    }

    if (lower.startsWith('--shield=')) {
      const value = arg.slice('--shield='.length).toLowerCase();
      if (value === 'on' || value === 'true') {
        shieldValue = true;
      } else if (value === 'off' || value === 'false') {
        shieldValue = false;
      } else {
        console.error('Shield value must be "on" or "off".');
        process.exit(1);
      }
      continue;
    }

    if (lower === '--weapon') {
      if (i + 1 >= rawArgs.length) {
        console.error('Expected value after --weapon.');
        process.exit(1);
      }
      weaponName = rawArgs[i + 1].trim();
      i += 1;
      continue;
    }

    if (lower.startsWith('--weapon=')) {
      weaponName = arg.slice('--weapon='.length).trim();
      continue;
    }

    if (lower === '--hitdie') {
      if (i + 1 >= rawArgs.length) {
        console.error('Expected value after --hitdie.');
        process.exit(1);
      }
      hitDie = rawArgs[i + 1].trim().toLowerCase() as HitDieValue;
      i += 1;
      continue;
    }

    if (lower.startsWith('--hitdie=')) {
      hitDie = arg.slice('--hitdie='.length).trim().toLowerCase() as HitDieValue;
      continue;
    }

    console.warn(`Ignoring unknown argument: ${arg}`);
  }

  if (armorName === undefined && shieldValue === undefined && weaponName === undefined && hitDie === undefined) {
    console.error('No changes provided for equip command.');
    process.exit(1);
  }

  const changes: string[] = [];

  if (armorName !== undefined) {
    if (armorName.length === 0) {
      console.error('Armor name cannot be empty.');
      process.exit(1);
    }
    const armor = getArmorByName(armorName);
    if (!armor) {
      console.error(`Unknown armor: ${armorName}`);
      process.exit(1);
    }
    equipped.armor = armor.name;
    changes.push(`Updated armor: ${armor.name}`);
  }

  if (shieldValue !== undefined) {
    equipped.shield = shieldValue;
    changes.push(`Updated shield: ${formatShieldValue(shieldValue)}`);
  }

  if (weaponName !== undefined) {
    if (weaponName.length === 0) {
      console.error('Weapon name cannot be empty.');
      process.exit(1);
    }
    const weapon = getWeaponByName(weaponName);
    if (!weapon) {
      console.error(`Unknown weapon: ${weaponName}`);
      process.exit(1);
    }
    equipped.weapon = weapon.name;
    changes.push(`Updated weapon: ${weapon.name}`);
  }

  if (hitDie !== undefined) {
    if (!['d6', 'd8', 'd10', 'd12'].includes(hitDie)) {
      console.error('Hit die must be one of d6, d8, d10, or d12.');
      process.exit(1);
    }
    equipped.hitDie = hitDie;
    changes.push(`Updated hit die: ${hitDie}`);
  }

  if (Object.keys(equipped).length > 0) {
    next.equipped = equipped;
  } else {
    delete next.equipped;
  }

  saveCharacter(next);
  changes.forEach((line) => console.log(line));
  printDerivedStats(next);
  process.exit(0);
}

function handleCharacterAddXpCommand(rawArgs: string[]): void {
  if (rawArgs.length === 0) {
    console.error('Missing XP amount.');
    process.exit(1);
  }

  let amount: number;
  try {
    amount = parseNonNegativeInteger(rawArgs[0], 'XP');
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
    return;
  }

  const character = requireLoadedCharacter();
  const current = character.xp ?? 0;
  character.xp = current + amount;
  saveCharacter(character);
  console.log(`Added ${amount} XP. Total XP: ${character.xp}`);
  process.exit(0);
}

function handleCharacterSetCommand(rawArgs: string[]): void {
  if (rawArgs.length === 0) {
    console.error('Provide at least one option to set.');
    process.exit(1);
  }

  const character = requireLoadedCharacter();
  let level: number | undefined;

  for (let i = 0; i < rawArgs.length; i += 1) {
    const arg = rawArgs[i];
    const lower = arg.toLowerCase();

    if (lower.startsWith('--level=')) {
      const value = Number.parseInt(arg.slice('--level='.length), 10);
      if (!Number.isFinite(value) || value <= 0) {
        console.error('Level must be a positive integer.');
        process.exit(1);
      }
      level = value;
      continue;
    }

    if (lower === '--level') {
      if (i + 1 >= rawArgs.length) {
        console.error('Expected value after --level.');
        process.exit(1);
      }
      const value = Number.parseInt(rawArgs[i + 1], 10);
      if (!Number.isFinite(value) || value <= 0) {
        console.error('Level must be a positive integer.');
        process.exit(1);
      }
      level = value;
      i += 1;
      continue;
    }

    console.warn(`Ignoring unknown argument: ${arg}`);
  }

  if (level === undefined) {
    console.error('No supported fields provided for set command.');
    process.exit(1);
  }

  const next: Character = { ...character };
  if (level !== undefined) {
    next.level = level;
  }

  saveCharacter(next);
  if (level !== undefined) {
    const levelMessage = level === character.level ? `Level remains ${level}.` : `Updated level: ${character.level} → ${level}.`;
    console.log(levelMessage);
  }

  const pb = proficiencyBonusForLevel(next.level);
  console.log(`Proficiency Bonus: ${formatModifier(pb)}`);
  printDerivedStats(next);
  process.exit(0);
}

function handleCharacterAttackCommand(rawArgs: string[]): void {
  if (rawArgs.length === 0) {
    console.error('Missing weapon name for character attack.');
    process.exit(1);
  }

  const [weaponName, ...rest] = rawArgs;
  const weapon = getWeaponByName(weaponName);
  if (!weapon) {
    console.error(`Unknown weapon: ${weaponName}`);
    console.error('Use `pnpm dev -- weapon list` to see available options.');
    process.exit(1);
  }

  const character = requireLoadedCharacter();

  let twoHanded = false;
  let advantage = false;
  let disadvantage = false;
  let targetAC: number | undefined;
  let seed: string | undefined;

  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    const lower = arg.toLowerCase();

    if (lower === '--twohanded' || lower === '--two-handed') {
      twoHanded = true;
      continue;
    }

    if (lower === '--adv' || lower === '--advantage') {
      advantage = true;
      continue;
    }

    if (lower === '--dis' || lower === '--disadvantage' || lower === '--disadv') {
      disadvantage = true;
      continue;
    }

    if (arg.startsWith('--ac=')) {
      targetAC = parseSignedInteger(arg.slice('--ac='.length), '--ac');
      continue;
    }

    if (lower === '--ac') {
      targetAC = parseSignedInteger(rest[i + 1], '--ac');
      i += 1;
      continue;
    }

    if (arg.startsWith('--seed=')) {
      seed = arg.slice('--seed='.length);
      continue;
    }

    if (lower === '--seed') {
      if (i + 1 >= rest.length) {
        console.error('Expected value after --seed.');
        process.exit(1);
      }
      seed = rest[i + 1];
      i += 1;
      continue;
    }

    console.warn(`Ignoring unknown argument: ${arg}`);
  }

  if (advantage && disadvantage) {
    console.error('Cannot roll with both advantage and disadvantage.');
    process.exit(1);
  }

  try {
    const result = characterWeaponAttack(character, weaponName, {
      twoHanded,
      advantage,
      disadvantage,
      targetAC,
      seed,
    });

    const abilityValues = abilityMods(character.abilities);
    const abilityUsed = chooseAttackAbility(weapon, abilityValues);
    const abilityModifier = abilityValues[abilityUsed] ?? 0;
    const proficient = Boolean(character.proficiencies?.weapons?.[weapon.category]);
    const pb = proficient ? proficiencyBonusForLevel(character.level) : 0;
    const outcome = getAttackOutcome(result.attack);

    console.log(`Character Attack: ${weapon.name}`);
    console.log(`Ability used: ${abilityUsed} (${formatModifier(abilityModifier)})`);
    console.log(
      `Proficiency: ${proficient ? `yes (PB ${formatModifier(pb)})` : 'no'}`,
    );
    console.log(`Attack: ${result.attack.expression}`);
    const rollsLine = `Rolls: [${result.attack.d20s.join(', ')}] → natural ${result.attack.natural} → total ${result.attack.total}`;
    console.log(outcome ? `${rollsLine} → ${outcome}` : rollsLine);

    if (result.damage) {
      console.log(`Damage: ${result.damage.expression}`);
      const parts = [`Rolls: [${result.damage.rolls.join(', ')}]`];
      if (result.damage.critRolls && result.damage.critRolls.length > 0) {
        parts.push(`+ crit [${result.damage.critRolls.join(', ')}]`);
      }
      parts.push(`→ base ${result.damage.baseTotal}`);
      parts.push(`→ final ${result.damage.finalTotal}`);
      console.log(parts.join(' '));
    } else {
      console.log('Damage: not rolled');
    }
    process.exit(0);
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error('Failed to resolve character attack.');
    }
    process.exit(1);
  }
}

function handleCharacterUnloadCommand(): void {
  clearCharacter();
  console.log('Character session cleared.');
  process.exit(0);
}

function handleCharacterCommand(rawArgs: string[]): void {
  if (rawArgs.length === 0) {
    console.error('Missing character subcommand.');
    showUsage();
    process.exit(1);
  }

  const [subcommand, ...rest] = rawArgs;

  if (subcommand === 'load') {
    handleCharacterLoadCommand(rest[0]);
    return;
  }

  if (subcommand === 'show') {
    handleCharacterShowCommand();
    return;
  }

  if (subcommand === 'derive') {
    handleCharacterDeriveCommand();
    return;
  }

  if (subcommand === 'check') {
    handleCharacterCheckCommand(rest);
    return;
  }

  if (subcommand === 'save') {
    handleCharacterSaveCommand(rest);
    return;
  }

  if (subcommand === 'skill') {
    handleCharacterSkillCommand(rest);
    return;
  }

  if (subcommand === 'skills') {
    handleCharacterSkillsCommand();
    return;
  }

  if (subcommand === 'attack') {
    handleCharacterAttackCommand(rest);
    return;
  }

  if (subcommand === 'list') {
    handleCharacterVaultListCommand();
    return;
  }

  if (subcommand === 'load-name') {
    handleCharacterVaultLoadCommand(rest[0]);
    return;
  }

  if (subcommand === 'equip') {
    handleCharacterEquipCommand(rest);
    return;
  }

  if (subcommand === 'add-xp') {
    handleCharacterAddXpCommand(rest);
    return;
  }

  if (subcommand === 'set') {
    handleCharacterSetCommand(rest);
    return;
  }

  if (subcommand === 'unload') {
    handleCharacterUnloadCommand();
    return;
  }

  console.error(`Unknown character subcommand: ${subcommand}`);
  process.exit(1);
}

function handleEncounterStartCommand(rawArgs: string[]): void {
  let seed: string | undefined;

  for (let i = 0; i < rawArgs.length; i += 1) {
    const arg = rawArgs[i];
    if (arg.startsWith('--seed=')) {
      seed = arg.slice('--seed='.length);
      continue;
    }
    if (arg === '--seed') {
      if (i + 1 >= rawArgs.length) {
        console.error('Expected value after --seed.');
        process.exit(1);
      }
      seed = rawArgs[i + 1];
      i += 1;
      continue;
    }

    console.warn(`Ignoring unknown argument: ${arg}`);
  }

  const encounter = createEncounter(seed);
  saveEncounter(encounter);
  const seedLabel = seed ? ` (seed="${seed}")` : '';
  console.log(`Encounter started${seedLabel}.`);
  process.exit(0);
}

function handleEncounterAddPcCommand(name: string): void {
  const encounter = requireEncounterState();
  const character = requireLoadedCharacter();
  const actor = buildPlayerActor(encounter, name, character);
  const nextState = addEncounterActor(encounter, actor);
  saveEncounter(nextState);
  console.log(`Added PC ${actor.name} (id=${actor.id}).`);
  process.exit(0);
}

async function handleEncounterAddMonsterCommand(rawArgs: string[]): Promise<void> {
  if (rawArgs.length === 0) {
    console.error('Missing monster name.');
    process.exit(1);
  }

  const [name, ...rest] = rawArgs;
  let count = 1;

  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (arg.startsWith('--count=')) {
      const value = Number.parseInt(arg.slice('--count='.length), 10);
      if (!Number.isFinite(value) || value <= 0) {
        console.error('--count must be a positive integer.');
        process.exit(1);
      }
      count = value;
      continue;
    }
    if (arg === '--count') {
      if (i + 1 >= rest.length) {
        console.error('Expected value after --count.');
        process.exit(1);
      }
      const value = Number.parseInt(rest[i + 1], 10);
      if (!Number.isFinite(value) || value <= 0) {
        console.error('--count must be a positive integer.');
        process.exit(1);
      }
      count = value;
      i += 1;
      continue;
    }

    console.warn(`Ignoring unknown argument: ${arg}`);
  }

  let template = getMonsterByName(name);
  if (!template) {
    try {
      template = await fetchMonster(name);
      console.log(`Fetched ${template.name} from the 5e API.`);
    } catch (error) {
      if (error instanceof Error) {
        console.error(error.message);
      } else {
        console.error(`Unknown monster: ${name}`);
      }
      process.exit(1);
    }
  }

  const encounter = requireEncounterState();
  const { state, added } = addMonsters(encounter, template, template.name, count);
  saveEncounter(state);
  const names = added.map((actor) => `${actor.name} (id=${actor.id})`).join(', ');
  console.log(`Added ${added.length} ${template.name}${added.length === 1 ? '' : 's'}: ${names}`);
  process.exit(0);
}

async function handleEncounterAddCommand(rawArgs: string[]): Promise<void> {
  if (rawArgs.length < 2) {
    console.error('Usage: pnpm dev -- encounter add <pc|monster> "<name>" [...]');
    process.exit(1);
  }

  const [type, ...rest] = rawArgs;
  if (type === 'pc') {
    const name = rest[0];
    if (!name) {
      console.error('Missing PC name.');
      process.exit(1);
    }
    handleEncounterAddPcCommand(name);
    return;
  }

  if (type === 'monster') {
    await handleEncounterAddMonsterCommand(rest);
    return;
  }

  console.error(`Unknown encounter add type: ${type}`);
  process.exit(1);
}

function handleEncounterListCommand(): void {
  const encounter = requireEncounterState();
  const current = encounterCurrentActor(encounter);

  console.log(`Encounter ${encounter.id}`);
  const orderSize = encounter.order.length;
  const turnLabel = orderSize > 0 ? `${encounter.turnIndex + 1}/${orderSize}` : 'n/a';
  console.log(`Round: ${encounter.round} | Turn: ${turnLabel}`);
  console.log('Actors:');
  const sorted = sortActorsForListing(encounter);
  sorted.forEach((actor) => {
    console.log(formatActorLine(encounter, actor, current?.id));
  });
  process.exit(0);
}

function handleEncounterRollInitCommand(): void {
  let encounter = requireEncounterState();
  encounter = rollEncounterInitiative(encounter);
  saveEncounter(encounter);

  console.log('Initiative order:');
  if (encounter.order.length === 0) {
    console.log('(no actors)');
  } else {
    encounter.order.forEach((entry, index) => {
      const actor = encounter.actors[entry.actorId];
      const name = actor ? actor.name : entry.actorId;
      const dex = actor?.abilityMods?.DEX ?? 0;
      console.log(
        `${index + 1}. ${name} (id=${entry.actorId}) → ${entry.total} = ${entry.rolled} + Dex ${formatModifier(dex)}`,
      );
    });
  }

  process.exit(0);
}

function handleEncounterNextCommand(): void {
  let encounter = requireEncounterState();
  encounter = encounterNextTurn(encounter);
  saveEncounter(encounter);

  if (encounter.order.length === 0) {
    console.log('No initiative order set.');
    process.exit(0);
  }

  const actor = encounterCurrentActor(encounter);
  console.log(`Round ${encounter.round}, turn ${encounter.turnIndex + 1}.`);
  if (actor) {
    console.log(`Current actor: ${actor.name} (id=${actor.id})`);
  } else {
    console.log('No active actor on this turn.');
  }
  process.exit(0);
}

function handleEncounterSaveCommand(rawArgs: string[]): void {
  if (rawArgs.length === 0) {
    console.error('Usage: pnpm dev -- encounter save "<name>"');
    process.exit(1);
  }

  const name = rawArgs.join(' ').trim();
  if (!name) {
    console.error('Encounter save name is required.');
    process.exit(1);
  }

  const encounter = loadEncounter();
  if (!encounter) {
    console.error('No encounter in progress. Use `pnpm dev -- encounter start` first.');
    process.exit(1);
  }

  saveEncounterAs(name, encounter);
  console.log(`Saved encounter as "${name}".`);
  process.exit(0);
}

function handleEncounterListSavesCommand(): void {
  const saves = listEncounterSaves();
  if (saves.length === 0) {
    console.log('No saved encounters.');
    process.exit(0);
  }

  console.log('Saved encounters:');
  saves.forEach((save) => {
    console.log(`- ${save}`);
  });
  process.exit(0);
}

function handleEncounterLoadCommand(rawArgs: string[]): void {
  if (rawArgs.length === 0) {
    console.error('Usage: pnpm dev -- encounter load "<name>"');
    process.exit(1);
  }

  const name = rawArgs.join(' ').trim();
  if (!name) {
    console.error('Encounter load name is required.');
    process.exit(1);
  }

  const encounter = loadEncounterByName(name);
  if (!encounter) {
    console.error(`No saved encounter named "${name}".`);
    process.exit(1);
  }

  saveEncounter(encounter);
  console.log(`Loaded encounter "${name}" into session.`);
  process.exit(0);
}

function handleEncounterDeleteCommand(rawArgs: string[]): void {
  if (rawArgs.length === 0) {
    console.error('Usage: pnpm dev -- encounter delete "<name>"');
    process.exit(1);
  }

  const name = rawArgs.join(' ').trim();
  if (!name) {
    console.error('Encounter delete name is required.');
    process.exit(1);
  }

  const removed = deleteEncounterByName(name);
  if (!removed) {
    console.error(`No saved encounter named "${name}".`);
    process.exit(1);
  }

  console.log(`Deleted saved encounter "${name}".`);
  process.exit(0);
}

function handleEncounterAttackCommand(rawArgs: string[]): void {
  if (rawArgs.length < 2) {
    console.error('Usage: pnpm dev -- encounter attack "<attacker>" "<defender>" [--adv|--dis] [--twohanded] [--seed <value>]');
    process.exit(1);
  }

  const [attackerRaw, defenderRaw, ...rest] = rawArgs;
  let advantage = false;
  let disadvantage = false;
  let twoHanded = false;
  let seed: string | undefined;

  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    const lower = arg.toLowerCase();

    if (lower === '--adv' || lower === '--advantage') {
      advantage = true;
      continue;
    }
    if (lower === '--dis' || lower === '--disadvantage' || lower === '--disadv') {
      disadvantage = true;
      continue;
    }
    if (lower === '--twohanded' || lower === '--two-handed') {
      twoHanded = true;
      continue;
    }
    if (arg.startsWith('--seed=')) {
      seed = arg.slice('--seed='.length);
      continue;
    }
    if (lower === '--seed') {
      if (i + 1 >= rest.length) {
        console.error('Expected value after --seed.');
        process.exit(1);
      }
      seed = rest[i + 1];
      i += 1;
      continue;
    }

    console.warn(`Ignoring unknown argument: ${arg}`);
  }

  if (advantage && disadvantage) {
    console.error('Cannot roll with both advantage and disadvantage.');
    process.exit(1);
  }

  let encounter = requireEncounterState();
  let attacker: EncounterActor;
  let defender: EncounterActor;

  try {
    attacker = findActorByIdentifier(encounter, attackerRaw);
    defender = findActorByIdentifier(encounter, defenderRaw);
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
  }

  const result = encounterActorAttack(encounter, attacker.id, defender.id, {
    advantage,
    disadvantage,
    twoHanded,
    seed,
  });

  encounter = result.state;
  saveEncounter(encounter);

  const outcome = getAttackOutcome(result.attack);
  console.log(`Attack: ${result.attack.expression}`);
  const rollsLine = `Rolls: [${result.attack.d20s.join(', ')}] → natural ${result.attack.natural} → total ${result.attack.total}`;
  console.log(outcome ? `${rollsLine} → ${outcome}` : rollsLine);

  if (result.damage) {
    console.log(`Damage: ${result.damage.expression}`);
    const parts = [`Rolls: [${result.damage.rolls.join(', ')}]`];
    if (result.damage.critRolls && result.damage.critRolls.length > 0) {
      parts.push(`+ crit [${result.damage.critRolls.join(', ')}]`);
    }
    parts.push(`→ base ${result.damage.baseTotal}`);
    parts.push(`→ final ${result.damage.finalTotal}`);
    console.log(parts.join(' '));
  }

  const updatedDefender = encounter.actors[defender.id];
  if (updatedDefender) {
    const status = encounter.defeated.has(defender.id) ? 'DEFEATED' : 'active';
    console.log(
      `Defender ${updatedDefender.name} (id=${updatedDefender.id}) now has ${formatHitPoints(updatedDefender)} HP (${status}).`,
    );
  }

  process.exit(0);
}

function handleEncounterLootCommand(rawArgs: string[]): void {
  const encounter = requireEncounterState();
  const defeated = defeatedMonstersWithCR(encounter);
  if (defeated.length === 0) {
    console.log('No defeated monsters to loot.');
    process.exit(0);
  }

  let seed: string | undefined;
  let itemsCount = 0;
  let note: string | undefined;

  try {
    for (let i = 0; i < rawArgs.length; i += 1) {
      const arg = rawArgs[i];
      if (arg.startsWith('--seed=')) {
        seed = arg.slice('--seed='.length);
        continue;
      }
      if (arg === '--seed') {
        seed = rawArgs[i + 1];
        if (seed === undefined) {
          throw new Error('Expected value after --seed.');
        }
        i += 1;
        continue;
      }
      if (arg.startsWith('--items=')) {
        itemsCount = parseNonNegativeInteger(arg.slice('--items='.length), '--items');
        continue;
      }
      if (arg === '--items') {
        itemsCount = parseNonNegativeInteger(rawArgs[i + 1], '--items');
        i += 1;
        continue;
      }
      if (arg.startsWith('--note=')) {
        note = arg.slice('--note='.length);
        continue;
      }
      if (arg === '--note') {
        note = rawArgs[i + 1];
        if (note === undefined) {
          throw new Error('Expected value after --note.');
        }
        i += 1;
        continue;
      }

      console.warn(`Ignoring unknown argument: ${arg}`);
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
  }

  const baseSeed = seed ?? encounter.seed;
  const totals: CoinBundle = { cp: 0, sp: 0, gp: 0, pp: 0 };

  defeated.forEach(({ actor, cr }) => {
    const coinSeed = baseSeed ? `${baseSeed}:${actor.id}` : undefined;
    const coins = rollCoinsForCR(cr, coinSeed);
    totals.cp += coins.cp;
    totals.sp += coins.sp;
    totals.gp += coins.gp;
    totals.pp += coins.pp;
  });

  const items: string[] = [];
  for (let i = 0; i < itemsCount; i += 1) {
    const itemSeed = baseSeed ? `${baseSeed}:item:${i}` : undefined;
    items.push(randomSimpleItem(itemSeed));
  }

  const updated = encounterRecordLoot(encounter, { coins: totals, items, note });
  saveEncounter(updated);

  console.log(`Loot (${defeated.length} defeated):`);
  console.log(`  Coins: ${formatCoinBundle(totals)}`);
  console.log(`  Items: ${items.length > 0 ? items.join(', ') : 'none'}`);
  if (note && note.length > 0) {
    console.log(`  Note: ${note}`);
  }
  console.log('Saved to encounter log.');
  process.exit(0);
}

function handleEncounterXpCommand(rawArgs: string[]): void {
  const encounter = requireEncounterState();
  const defeated = defeatedMonstersWithCR(encounter);
  if (defeated.length === 0) {
    console.log('No defeated monsters for XP.');
    process.exit(0);
  }

  let partySize = 1;

  try {
    for (let i = 0; i < rawArgs.length; i += 1) {
      const arg = rawArgs[i];
      if (arg.startsWith('--party=')) {
        partySize = parsePositiveInteger(arg.slice('--party='.length), '--party');
        continue;
      }
      if (arg === '--party') {
        partySize = parsePositiveInteger(rawArgs[i + 1], '--party');
        i += 1;
        continue;
      }

      console.warn(`Ignoring unknown argument: ${arg}`);
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
  }

  const crs = defeated.map((entry) => entry.cr);
  const total = totalXP(crs);
  const updated = encounterRecordXP(encounter, { crs, total });
  saveEncounter(updated);

  const share = partySize > 0 ? total / partySize : total;
  const shareLabel = Number.isInteger(share) ? `${share}` : share.toFixed(2);
  const partyLabel = partySize > 0 ? ` (party size ${partySize} ⇒ ${shareLabel} each)` : '';

  console.log(`Total XP: ${total}${partyLabel}`);
  console.log('Saved to encounter log.');
  process.exit(0);
}

function handleEncounterEndCommand(): void {
  clearEncounter();
  console.log('Encounter ended.');
  process.exit(0);
}

async function handleEncounterCommand(rawArgs: string[]): Promise<void> {
  if (rawArgs.length === 0) {
    console.error('Missing encounter subcommand.');
    showUsage();
    process.exit(1);
  }

  const [subcommand, ...rest] = rawArgs;

  if (subcommand === 'start') {
    handleEncounterStartCommand(rest);
    return;
  }

  if (subcommand === 'add') {
    await handleEncounterAddCommand(rest);
    return;
  }

  if (subcommand === 'list') {
    handleEncounterListCommand();
    return;
  }

  if (subcommand === 'save') {
    handleEncounterSaveCommand(rest);
    return;
  }

  if (subcommand === 'list-saves') {
    handleEncounterListSavesCommand();
    return;
  }

  if (subcommand === 'load') {
    handleEncounterLoadCommand(rest);
    return;
  }

  if (subcommand === 'delete') {
    handleEncounterDeleteCommand(rest);
    return;
  }

  if (subcommand === 'roll-init') {
    handleEncounterRollInitCommand();
    return;
  }

  if (subcommand === 'next') {
    handleEncounterNextCommand();
    return;
  }

  if (subcommand === 'loot') {
    handleEncounterLootCommand(rest);
    return;
  }

  if (subcommand === 'xp') {
    handleEncounterXpCommand(rest);
    return;
  }

  if (subcommand === 'attack') {
    handleEncounterAttackCommand(rest);
    return;
  }

  if (subcommand === 'end') {
    handleEncounterEndCommand();
    return;
  }

  console.error(`Unknown encounter subcommand: ${subcommand}`);
  process.exit(1);
}

async function handleMonsterFetchCommand(name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) {
    console.error('Monster name is required.');
    process.exit(1);
  }

  try {
    const monster = await fetchMonster(trimmed);
    const attackSummary = formatMonsterAttack(monster.attacks[0]);
    console.log(`${monster.name} — AC ${monster.ac}, HP ${monster.hp}`);
    console.log(`Attack: ${attackSummary}`);
    console.log(`Cached at ${monsterCachePath(trimmed)}`);
    process.exit(0);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Failed to fetch monster: ${error.message}`);
    } else {
      console.error('Failed to fetch monster.');
    }
    process.exit(1);
  }
}

function handleMonsterListCommand(): void {
  const slugs = listCachedMonsters();
  if (slugs.length === 0) {
    console.log('No cached monsters.');
    process.exit(0);
  }

  console.log('Cached monsters:');
  slugs.forEach((slug) => {
    try {
      const data = readCachedMonster(slug);
      const displayName = typeof data?.name === 'string' ? data.name : slug;
      console.log(`- ${displayName} (${slug})`);
    } catch {
      console.log(`- ${slug}`);
    }
  });
  process.exit(0);
}

async function handleMonsterShowCommand(name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) {
    console.error('Monster name is required.');
    process.exit(1);
  }

  try {
    const monster = await fetchMonster(trimmed);
    const attackSummary = formatMonsterAttack(monster.attacks[0]);
    console.log(`${monster.name} — AC ${monster.ac}, HP ${monster.hp}`);
    console.log(`Attack: ${attackSummary}`);
    process.exit(0);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Failed to load monster: ${error.message}`);
    } else {
      console.error('Failed to load monster.');
    }
    process.exit(1);
  }
}

async function handleMonsterCommand(rawArgs: string[]): Promise<void> {
  if (rawArgs.length === 0) {
    console.error('Missing monster subcommand.');
    showUsage();
    process.exit(1);
  }

  const [subcommand, ...rest] = rawArgs;

  if (subcommand === 'fetch') {
    if (rest.length === 0) {
      console.error('Missing monster name for fetch command.');
      process.exit(1);
    }
    await handleMonsterFetchCommand(rest[0]);
    return;
  }

  if (subcommand === 'list') {
    handleMonsterListCommand();
    return;
  }

  if (subcommand === 'show') {
    if (rest.length === 0) {
      console.error('Missing monster name for show command.');
      process.exit(1);
    }
    await handleMonsterShowCommand(rest[0]);
    return;
  }

  console.error(`Unknown monster subcommand: ${subcommand}`);
  process.exit(1);
}

function applyProficiencyList(value: string | undefined, proficiencies: Proficiencies): void {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('Expected value after --profs.');
  }

  value
    .split(/[,|]/)
    .flatMap((segment) => segment.split(/\s+/))
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0)
    .forEach((entry) => {
      if (entry === 'simple' || entry === 'martial') {
        proficiencies[entry] = true;
      }
    });
}

function handleWeaponListCommand(): void {
  const names = [...WEAPONS].map((weapon) => weapon.name).sort((a, b) => a.localeCompare(b));
  console.log('Available weapons:');
  names.forEach((name) => console.log(`- ${name}`));
  process.exit(0);
}

function handleWeaponInfoCommand(rawName: string): void {
  const weapon = getWeaponByName(rawName);
  if (!weapon) {
    console.error(`Unknown weapon: ${rawName}`);
    console.error('Use `pnpm dev -- weapon list` to see available options.');
    process.exit(1);
  }

  console.log(weapon.name);
  console.log(`Category: ${weapon.category}`);
  console.log(`Type: ${weapon.type}`);
  console.log(`Damage: ${weapon.damage.expression} ${weapon.damage.type}`);
  if (weapon.versatile) {
    console.log(`Versatile: ${weapon.versatile.expression}`);
  }
  if (weapon.range) {
    const { normal, long } = weapon.range;
    const rangeLabel = typeof long === 'number' ? `${normal}/${long}` : `${normal}`;
    console.log(`Range: ${rangeLabel}`);
  }
  console.log(`Properties: ${formatWeaponProperties(weapon)}`);
  process.exit(0);
}

function handleWeaponAttackCommand(weapon: Weapon, rawArgs: string[]): void {
  const abilityMods: AbilityMods = {};
  const proficiencies: Proficiencies = {};
  let proficiencyBonus: number | undefined;
  let twoHanded = false;
  let advantage = false;
  let disadvantage = false;
  let targetAC: number | undefined;
  let seed: string | undefined;

  try {
    for (let i = 0; i < rawArgs.length; i += 1) {
      const arg = rawArgs[i];
      const lower = arg.toLowerCase();

      let handled = false;
      for (const ability of ABILITY_NAMES) {
        const flag = `--${ability.toLowerCase()}`;
        if (lower === flag) {
          abilityMods[ability] = parseSignedInteger(rawArgs[i + 1], flag);
          i += 1;
          handled = true;
          break;
        }
        if (lower.startsWith(`${flag}=`)) {
          abilityMods[ability] = parseSignedInteger(arg.slice(`${flag}=`.length), flag);
          handled = true;
          break;
        }
      }
      if (handled) {
        continue;
      }

      if (lower === '--twohanded' || lower === '--two-handed') {
        twoHanded = true;
        continue;
      }

      if (lower === '--adv' || lower === '--advantage') {
        advantage = true;
        continue;
      }

      if (lower === '--dis' || lower === '--disadvantage' || lower === '--disadv') {
        disadvantage = true;
        continue;
      }

      if (arg.startsWith('--pb=')) {
        proficiencyBonus = parseSignedInteger(arg.slice('--pb='.length), '--pb');
        continue;
      }

      if (lower === '--pb') {
        proficiencyBonus = parseSignedInteger(rawArgs[i + 1], '--pb');
        i += 1;
        continue;
      }

      if (arg.startsWith('--ac=')) {
        targetAC = parseSignedInteger(arg.slice('--ac='.length), '--ac');
        continue;
      }

      if (lower === '--ac') {
        targetAC = parseSignedInteger(rawArgs[i + 1], '--ac');
        i += 1;
        continue;
      }

      if (arg.startsWith('--seed=')) {
        seed = arg.slice('--seed='.length);
        continue;
      }

      if (lower === '--seed') {
        if (i + 1 >= rawArgs.length) {
          throw new Error('Expected value after --seed.');
        }
        seed = rawArgs[i + 1];
        i += 1;
        continue;
      }

      if (arg.startsWith('--profs=')) {
        applyProficiencyList(arg.slice('--profs='.length), proficiencies);
        continue;
      }

      if (lower === '--profs') {
        applyProficiencyList(rawArgs[i + 1], proficiencies);
        i += 1;
        continue;
      }

      console.warn(`Ignoring unknown argument: ${arg}`);
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
  }

  if (advantage && disadvantage) {
    console.error('Cannot roll with both advantage and disadvantage.');
    process.exit(1);
  }

  const ability = chooseAttackAbility(weapon, abilityMods);
  const abilityMod = abilityMods[ability] ?? 0;
  const result = resolveWeaponAttack({
    weapon,
    abilities: abilityMods,
    proficiencies: Object.keys(proficiencies).length > 0 ? proficiencies : undefined,
    proficiencyBonus,
    twoHanded,
    advantage,
    disadvantage,
    targetAC,
    seed,
  });

  const proficient = Boolean(proficiencies[weapon.category]);
  const pbUsed = proficient ? (Number.isFinite(proficiencyBonus) ? (proficiencyBonus as number) : 2) : 0;
  const outcome = getAttackOutcome(result.attack);

  console.log(`Weapon Attack: ${weapon.name}`);
  console.log(`Ability used: ${ability} (${formatModifier(abilityMod)})`);
  console.log(
    `Proficiency: ${proficient ? 'yes' : 'no'}${proficient ? ` (PB ${formatModifier(pbUsed)})` : ''}`.trim(),
  );
  console.log(`Attack: ${result.attack.expression}`);
  const rollsLine = `Rolls: [${result.attack.d20s.join(', ')}] → natural ${result.attack.natural} → total ${result.attack.total}`;
  console.log(outcome ? `${rollsLine} → ${outcome}` : rollsLine);
  if (outcome) {
    console.log(`Result: ${outcome}`);
  }

  if (result.damage) {
    console.log(`Damage: ${result.damage.expression}`);
    const parts = [`Rolls: [${result.damage.rolls.join(', ')}]`];
    if (result.damage.critRolls && result.damage.critRolls.length > 0) {
      parts.push(`+ crit [${result.damage.critRolls.join(', ')}]`);
    }
    parts.push(`→ base ${result.damage.baseTotal}`);
    parts.push(`→ final ${result.damage.finalTotal}`);
    console.log(parts.join(' '));
  } else {
    console.log('Damage: not rolled');
  }

  process.exit(0);
}

function handleWeaponCommand(rawArgs: string[]): void {
  if (rawArgs.length === 0) {
    console.error('Missing weapon subcommand.');
    showUsage();
    process.exit(1);
  }

  const [subcommand, ...rest] = rawArgs;
  if (subcommand === 'list') {
    handleWeaponListCommand();
    return;
  }

  if (subcommand === 'info') {
    if (rest.length === 0) {
      console.error('Missing weapon name for info command.');
      process.exit(1);
    }
    handleWeaponInfoCommand(rest[0]);
    return;
  }

  if (subcommand === 'attack') {
    if (rest.length === 0) {
      console.error('Missing weapon name for attack command.');
      process.exit(1);
    }
    const [weaponName, ...attackArgs] = rest;
    const weapon = getWeaponByName(weaponName);
    if (!weapon) {
      console.error(`Unknown weapon: ${weaponName}`);
      console.error('Use `pnpm dev -- weapon list` to see available options.');
      process.exit(1);
    }
    handleWeaponAttackCommand(weapon, attackArgs);
    return;
  }

  console.error(`Unknown weapon subcommand: ${subcommand}`);
  process.exit(1);
}

function handleCheckCommand(type: 'check' | 'save', rawArgs: string[]): void {
  if (rawArgs.length === 0) {
    console.error('Missing ability for check.');
    showUsage();
    process.exit(1);
  }

  const abilityRaw = rawArgs[0].toUpperCase();
  if (!isAbilityName(abilityRaw)) {
    console.error(`Invalid ability name: ${rawArgs[0]}`);
    process.exit(1);
  }
  const ability = abilityRaw as AbilityName;

  let modifier = 0;
  let startIndex = 1;
  try {
    modifier = parseModifier(rawArgs[1]);
    if (rawArgs[1] && !rawArgs[1].startsWith('--')) {
      startIndex = 2;
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
  }

  let proficient = false;
  let proficiencyBonus: number | undefined;
  let advantage = false;
  let disadvantage = false;
  let dc: number | undefined;
  let seed: string | undefined;

  for (let i = startIndex; i < rawArgs.length; i += 1) {
    const arg = rawArgs[i];
    const lower = arg.toLowerCase();

    if (lower === '--proficient') {
      proficient = true;
      continue;
    }

    if (lower === '--adv' || lower === '--advantage') {
      advantage = true;
      continue;
    }

    if (lower === '--dis' || lower === '--disadvantage' || lower === '--disadv') {
      disadvantage = true;
      continue;
    }

    if (arg.startsWith('--pb=')) {
      const value = Number.parseInt(arg.slice('--pb='.length), 10);
      if (Number.isNaN(value)) {
        console.error('Proficiency bonus must be a number.');
        process.exit(1);
      }
      proficiencyBonus = value;
      continue;
    }

    if (lower === '--pb') {
      if (i + 1 >= rawArgs.length) {
        console.error('Expected value after --pb.');
        process.exit(1);
      }
      const value = Number.parseInt(rawArgs[i + 1], 10);
      if (Number.isNaN(value)) {
        console.error('Proficiency bonus must be a number.');
        process.exit(1);
      }
      proficiencyBonus = value;
      i += 1;
      continue;
    }

    if (arg.startsWith('--dc=')) {
      const value = Number.parseInt(arg.slice('--dc='.length), 10);
      if (Number.isNaN(value)) {
        console.error('DC must be an integer.');
        process.exit(1);
      }
      dc = value;
      continue;
    }

    if (lower === '--dc') {
      if (i + 1 >= rawArgs.length) {
        console.error('Expected value after --dc.');
        process.exit(1);
      }
      const value = Number.parseInt(rawArgs[i + 1], 10);
      if (Number.isNaN(value)) {
        console.error('DC must be an integer.');
        process.exit(1);
      }
      dc = value;
      i += 1;
      continue;
    }

    if (arg.startsWith('--seed=')) {
      seed = arg.slice('--seed='.length);
      continue;
    }

    if (lower === '--seed') {
      if (i + 1 >= rawArgs.length) {
        console.error('Expected value after --seed.');
        process.exit(1);
      }
      seed = rawArgs[i + 1];
      i += 1;
      continue;
    }

    console.warn(`Ignoring unknown argument: ${arg}`);
  }

  if (advantage && disadvantage) {
    console.error('Cannot roll with both advantage and disadvantage.');
    process.exit(1);
  }

  const options = {
    ability,
    modifier,
    proficient,
    proficiencyBonus,
    advantage,
    disadvantage,
    dc,
    seed,
  } as const;

  const result = type === 'check' ? abilityCheck(options) : savingThrow(options);

  const pbUsed = proficient
    ? (Number.isFinite(proficiencyBonus) ? (proficiencyBonus as number) : 2)
    : 0;
  const pbLabel = proficient ? ` (proficient ${formatModifier(pbUsed)})` : '';
  const modifierLabel = formatModifier(modifier);
  const advLabel = advantage ? ' adv' : disadvantage ? ' dis' : '';
  const dcLabel = typeof dc === 'number' ? ` vs DC ${dc}` : '';
  const title = type === 'check' ? 'Ability Check' : 'Saving Throw';

  console.log(
    `${title}: ${abilityRaw} ${modifierLabel}${pbLabel}${advLabel}${dcLabel}`.trim(),
  );
  console.log(`Rolls: [${result.rolls.join(', ')}] → total ${result.total}`);
  if (typeof result.success === 'boolean') {
    console.log(`Result: ${result.success ? 'SUCCESS' : 'FAILURE'}`);
  } else {
    console.log(`Result: ${result.total}`);
  }
  process.exit(0);
}

function parseSignedInteger(value: string | undefined, label: string): number {
  if (typeof value !== 'string') {
    throw new Error(`Expected value for ${label}.`);
  }

  const cleaned = value.replace(/^\+/, '');
  const parsed = Number.parseInt(cleaned, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`${label} must be an integer.`);
  }

  return parsed;
}

function parseNonNegativeInteger(value: string | undefined, label: string): number {
  const parsed = parseSignedInteger(value, label);
  if (parsed < 0) {
    throw new Error(`${label} must be zero or a positive integer.`);
  }
  return parsed;
}

function parsePositiveInteger(value: string | undefined, label: string): number {
  const parsed = parseSignedInteger(value, label);
  if (parsed <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return parsed;
}

function getAttackOutcome(attack: AttackRollResult): string | undefined {
  if (attack.isCrit) {
    return 'CRIT!';
  }
  if (attack.isFumble) {
    return 'FUMBLE';
  }
  if (attack.hit === true) {
    return 'HIT';
  }
  if (attack.hit === false) {
    return 'MISS';
  }
  return undefined;
}

function handleAttackCommand(rawArgs: string[]): void {
  let abilityMod = 0;
  let proficient = false;
  let proficiencyBonus: number | undefined;
  let advantage = false;
  let disadvantage = false;
  let targetAC: number | undefined;
  let seed: string | undefined;

  try {
    for (let i = 0; i < rawArgs.length; i += 1) {
      const arg = rawArgs[i];
      const lower = arg.toLowerCase();

      if (lower === '--proficient') {
        proficient = true;
        continue;
      }

      if (lower === '--adv' || lower === '--advantage') {
        advantage = true;
        continue;
      }

      if (lower === '--dis' || lower === '--disadvantage' || lower === '--disadv') {
        disadvantage = true;
        continue;
      }

      if (arg.startsWith('--mod=')) {
        abilityMod = parseSignedInteger(arg.slice('--mod='.length), '--mod');
        continue;
      }

      if (lower === '--mod') {
        abilityMod = parseSignedInteger(rawArgs[i + 1], '--mod');
        i += 1;
        continue;
      }

      if (arg.startsWith('--pb=')) {
        proficiencyBonus = parseSignedInteger(arg.slice('--pb='.length), '--pb');
        continue;
      }

      if (lower === '--pb') {
        proficiencyBonus = parseSignedInteger(rawArgs[i + 1], '--pb');
        i += 1;
        continue;
      }

      if (arg.startsWith('--ac=')) {
        targetAC = parseSignedInteger(arg.slice('--ac='.length), '--ac');
        continue;
      }

      if (lower === '--ac') {
        targetAC = parseSignedInteger(rawArgs[i + 1], '--ac');
        i += 1;
        continue;
      }

      if (arg.startsWith('--seed=')) {
        seed = arg.slice('--seed='.length);
        continue;
      }

      if (lower === '--seed') {
        if (i + 1 >= rawArgs.length) {
          throw new Error('Expected value after --seed.');
        }
        seed = rawArgs[i + 1];
        i += 1;
        continue;
      }

      console.warn(`Ignoring unknown argument: ${arg}`);
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
  }

  if (advantage && disadvantage) {
    console.error('Cannot roll with both advantage and disadvantage.');
    process.exit(1);
  }

  const attack = attackRoll({
    abilityMod,
    proficient,
    proficiencyBonus,
    advantage,
    disadvantage,
    seed,
    targetAC,
  });

  const outcome = getAttackOutcome(attack);

  console.log(`Attack: ${attack.expression}`);
  const rollsLine = `Rolls: [${attack.d20s.join(', ')}] → natural ${attack.natural} → total ${attack.total}`;
  console.log(outcome ? `${rollsLine} → ${outcome}` : rollsLine);
  if (outcome) {
    console.log(`Result: ${outcome}`);
  }

  process.exit(0);
}

function handleDamageCommand(rawArgs: string[]): void {
  if (rawArgs.length === 0) {
    console.error('Missing damage expression.');
    showUsage();
    process.exit(1);
  }

  const [expression, ...rest] = rawArgs;
  let crit = false;
  let resistance = false;
  let vulnerability = false;
  let seed: string | undefined;

  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    const lower = arg.toLowerCase();

    if (lower === '--crit') {
      crit = true;
      continue;
    }

    if (lower === '--resist' || lower === '--resistance') {
      resistance = true;
      continue;
    }

    if (lower === '--vuln' || lower === '--vulnerability') {
      vulnerability = true;
      continue;
    }

    if (arg.startsWith('--seed=')) {
      seed = arg.slice('--seed='.length);
      continue;
    }

    if (lower === '--seed') {
      if (i + 1 >= rest.length) {
        console.error('Expected value after --seed.');
        process.exit(1);
      }
      seed = rest[i + 1];
      i += 1;
      continue;
    }

    console.warn(`Ignoring unknown argument: ${arg}`);
  }

  const result = damageRoll({ expression, crit, resistance, vulnerability, seed });

  console.log(`Damage: ${result.expression}`);
  const parts = [`Rolls: [${result.rolls.join(', ')}]`];
  if (result.critRolls && result.critRolls.length > 0) {
    parts.push(`+ crit [${result.critRolls.join(', ')}]`);
  }
  parts.push(`→ base ${result.baseTotal}`);
  parts.push(`→ final ${result.finalTotal}`);
  console.log(parts.join(' '));

  process.exit(0);
}

function handleResolveCommand(rawArgs: string[]): void {
  let abilityMod = 0;
  let proficient = false;
  let proficiencyBonus: number | undefined;
  let advantage = false;
  let disadvantage = false;
  let targetAC: number | undefined;
  let seed: string | undefined;
  let damageExpression: string | undefined;
  let damageSeed: string | undefined;
  let damageCrit = false;
  let damageResistance = false;
  let damageVulnerability = false;

  try {
    for (let i = 0; i < rawArgs.length; i += 1) {
      const arg = rawArgs[i];
      const lower = arg.toLowerCase();

      if (arg.startsWith('--dmg=')) {
        damageExpression = arg.slice('--dmg='.length);
        continue;
      }

      if (lower === '--dmg') {
        if (i + 1 >= rawArgs.length) {
          throw new Error('Expected value after --dmg.');
        }
        damageExpression = rawArgs[i + 1];
        i += 1;
        continue;
      }

      if (arg.startsWith('--dmg-seed=')) {
        damageSeed = arg.slice('--dmg-seed='.length);
        continue;
      }

      if (lower === '--dmg-seed') {
        if (i + 1 >= rawArgs.length) {
          throw new Error('Expected value after --dmg-seed.');
        }
        damageSeed = rawArgs[i + 1];
        i += 1;
        continue;
      }

      if (lower === '--crit') {
        damageCrit = true;
        continue;
      }

      if (lower === '--resist' || lower === '--resistance') {
        damageResistance = true;
        continue;
      }

      if (lower === '--vuln' || lower === '--vulnerability') {
        damageVulnerability = true;
        continue;
      }

      if (lower === '--proficient') {
        proficient = true;
        continue;
      }

      if (lower === '--adv' || lower === '--advantage') {
        advantage = true;
        continue;
      }

      if (lower === '--dis' || lower === '--disadvantage' || lower === '--disadv') {
        disadvantage = true;
        continue;
      }

      if (arg.startsWith('--mod=')) {
        abilityMod = parseSignedInteger(arg.slice('--mod='.length), '--mod');
        continue;
      }

      if (lower === '--mod') {
        abilityMod = parseSignedInteger(rawArgs[i + 1], '--mod');
        i += 1;
        continue;
      }

      if (arg.startsWith('--pb=')) {
        proficiencyBonus = parseSignedInteger(arg.slice('--pb='.length), '--pb');
        continue;
      }

      if (lower === '--pb') {
        proficiencyBonus = parseSignedInteger(rawArgs[i + 1], '--pb');
        i += 1;
        continue;
      }

      if (arg.startsWith('--ac=')) {
        targetAC = parseSignedInteger(arg.slice('--ac='.length), '--ac');
        continue;
      }

      if (lower === '--ac') {
        targetAC = parseSignedInteger(rawArgs[i + 1], '--ac');
        i += 1;
        continue;
      }

      if (arg.startsWith('--seed=')) {
        seed = arg.slice('--seed='.length);
        continue;
      }

      if (lower === '--seed') {
        if (i + 1 >= rawArgs.length) {
          throw new Error('Expected value after --seed.');
        }
        seed = rawArgs[i + 1];
        i += 1;
        continue;
      }

      console.warn(`Ignoring unknown argument: ${arg}`);
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
  }

  if (!damageExpression) {
    console.error('Missing damage expression. Provide --dmg "<expression>".');
    process.exit(1);
  }

  if (advantage && disadvantage) {
    console.error('Cannot roll with both advantage and disadvantage.');
    process.exit(1);
  }

  const result = resolveAttack({
    abilityMod,
    proficient,
    proficiencyBonus,
    advantage,
    disadvantage,
    seed,
    targetAC,
    damage: {
      expression: damageExpression,
      crit: damageCrit,
      resistance: damageResistance,
      vulnerability: damageVulnerability,
      seed: damageSeed,
    },
  });

  const { attack, damage } = result;
  const outcome = getAttackOutcome(attack);

  console.log(`Attack: ${attack.expression}`);
  const rollsLine = `Rolls: [${attack.d20s.join(', ')}] → natural ${attack.natural} → total ${attack.total}`;
  console.log(outcome ? `${rollsLine} → ${outcome}` : rollsLine);

  if (damage) {
    console.log(`Damage: ${damage.expression}`);
    const parts = [`Rolls: [${damage.rolls.join(', ')}]`];
    if (damage.critRolls && damage.critRolls.length > 0) {
      parts.push(`+ crit [${damage.critRolls.join(', ')}]`);
    }
    parts.push(`→ base ${damage.baseTotal}`);
    parts.push(`→ final ${damage.finalTotal}`);
    console.log(parts.join(' '));
  }

  process.exit(0);
}

async function main(): Promise<void> {
  const [, , ...argv] = process.argv;
  const args = argv[0] === '--' ? argv.slice(1) : argv;

  if (args.length === 0 || args[0] === 'help' || args[0] === '--help') {
    showUsage();
    process.exit(0);
  }

  const [command, ...rest] = args;

  if (command === 'roll') {
    if (rest.length === 0) {
      console.error('Missing dice expression.');
      showUsage();
      process.exit(1);
    }

    const [expression, ...rawArgs] = rest;
    let advantage = false;
    let disadvantage = false;
    let seed: string | undefined;

    for (let i = 0; i < rawArgs.length; i += 1) {
      const arg = rawArgs[i];
      const lower = arg.toLowerCase();
      if (lower === 'adv' || lower === 'advantage') {
        advantage = true;
        continue;
      }
      if (lower === 'dis' || lower === 'disadvantage' || lower === 'disadv') {
        disadvantage = true;
        continue;
      }
      if (arg.startsWith('--seed=')) {
        seed = arg.slice('--seed='.length);
        continue;
      }
      if (lower === '--seed') {
        if (i + 1 >= rawArgs.length) {
          console.error('Expected value after --seed.');
          process.exit(1);
        }
        seed = rawArgs[i + 1];
        i += 1;
        continue;
      }

      console.warn(`Ignoring unknown argument: ${arg}`);
    }

    if (advantage && disadvantage) {
      console.error('Cannot roll with both advantage and disadvantage.');
      process.exit(1);
    }

    const advLabel = advantage ? ' with advantage' : disadvantage ? ' with disadvantage' : '';
    console.log(`Rolling ${expression}${advLabel}...`);

    const result = roll(expression, { advantage, disadvantage, seed });

    console.log(`Rolls: [${result.rolls.join(', ')}] → total ${result.total}`);
    process.exit(0);
  }

  if (command === 'character') {
    handleCharacterCommand(rest);
    return;
  }

  if (command === 'encounter') {
    await handleEncounterCommand(rest);
    return;
  }

  if (command === 'monster') {
    await handleMonsterCommand(rest);
    return;
  }

  if (command === 'check' || command === 'save') {
    handleCheckCommand(command, rest);
    return;
  }

  if (command === 'attack') {
    handleAttackCommand(rest);
    return;
  }

  if (command === 'damage') {
    handleDamageCommand(rest);
    return;
  }

  if (command === 'resolve') {
    handleResolveCommand(rest);
    return;
  }

  if (command === 'weapon') {
    handleWeaponCommand(rest);
    return;
  }

  if (command === 'abilities') {
    if (rest.length === 0) {
      console.error('Missing abilities subcommand.');
      showUsage();
      process.exit(1);
    }

    const [subcommand, ...rawArgs] = rest;

    if (subcommand === 'roll') {
      let seed: string | undefined;
      let count: number | undefined;
      let drop: number | undefined;
      let sort: 'none' | 'asc' | 'desc' | undefined;

      for (let i = 0; i < rawArgs.length; i += 1) {
        const arg = rawArgs[i];
        if (arg.startsWith('--seed=')) {
          seed = arg.slice('--seed='.length);
          continue;
        }
        if (arg === '--seed') {
          if (i + 1 >= rawArgs.length) {
            console.error('Expected value after --seed.');
            process.exit(1);
          }
          seed = rawArgs[i + 1];
          i += 1;
          continue;
        }
        if (arg.startsWith('--count=')) {
          const value = Number.parseInt(arg.slice('--count='.length), 10);
          if (Number.isNaN(value) || value <= 0) {
            console.error('Count must be a positive integer.');
            process.exit(1);
          }
          count = value;
          continue;
        }
        if (arg === '--count') {
          if (i + 1 >= rawArgs.length) {
            console.error('Expected value after --count.');
            process.exit(1);
          }
          const value = Number.parseInt(rawArgs[i + 1], 10);
          if (Number.isNaN(value) || value <= 0) {
            console.error('Count must be a positive integer.');
            process.exit(1);
          }
          count = value;
          i += 1;
          continue;
        }
        if (arg.startsWith('--drop=')) {
          const value = Number.parseInt(arg.slice('--drop='.length), 10);
          if (Number.isNaN(value) || value < 0) {
            console.error('Drop must be zero or a positive integer.');
            process.exit(1);
          }
          drop = value;
          continue;
        }
        if (arg === '--drop') {
          if (i + 1 >= rawArgs.length) {
            console.error('Expected value after --drop.');
            process.exit(1);
          }
          const value = Number.parseInt(rawArgs[i + 1], 10);
          if (Number.isNaN(value) || value < 0) {
            console.error('Drop must be zero or a positive integer.');
            process.exit(1);
          }
          drop = value;
          i += 1;
          continue;
        }
        if (arg.startsWith('--sort=')) {
          const value = arg.slice('--sort='.length);
          if (value === 'asc' || value === 'desc' || value === 'none') {
            sort = value;
          } else {
            console.error('Sort must be one of: asc, desc, none.');
            process.exit(1);
          }
          continue;
        }
        if (arg === '--sort') {
          if (i + 1 >= rawArgs.length) {
            console.error('Expected value after --sort.');
            process.exit(1);
          }
          const value = rawArgs[i + 1];
          if (value === 'asc' || value === 'desc' || value === 'none') {
            sort = value;
          } else {
            console.error('Sort must be one of: asc, desc, none.');
            process.exit(1);
          }
          i += 1;
          continue;
        }

        console.warn(`Ignoring unknown argument: ${arg}`);
      }

      const { sets, details } = rollAbilityScores({ seed, count, drop, sort });
      const sortLabel = sort ? sort : 'none';

      console.log(`Ability Scores (4d6 drop lowest, seed=${seed ? `"${seed}"` : 'none'}, sort=${sortLabel})`);
      console.log(`Sets: [${sets.join(', ')}]`);
      const detailStrings = details
        .map((rolls, index) => {
          const total = sets[index];
          return `[${rolls.join(',')}] -> ${total}`;
        })
        .join(', ');
      console.log(`Details per stat: [${detailStrings}]`);
      process.exit(0);
    }

    if (subcommand === 'standard') {
      console.log(`Standard Array: [${standardArray().join(', ')}]`);
      process.exit(0);
    }

    if (subcommand === 'pointbuy') {
      if (rawArgs.length === 0) {
        console.error('Missing ability scores for point buy.');
        showUsage();
        process.exit(1);
      }

      const scores = rawArgs[0]
        .split(',')
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
        .map((value) => Number.parseInt(value, 10));

      const result = validatePointBuy(scores);

      if (result.ok) {
        console.log(`Point Buy: OK (cost ${result.cost} / budget ${result.budget})`);
      } else {
        console.log('Point Buy: INVALID');
        result.errors.forEach((message) => {
          console.log(`- ${message}`);
        });
      }
      process.exit(result.ok ? 0 : 1);
    }

    console.error(`Unknown abilities subcommand: ${subcommand}`);
    showUsage();
    process.exit(1);
  }

  console.error(`Unknown command: ${command}`);
  showUsage();
  process.exit(1);
}

void main().catch((error) => {
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(String(error));
  }
  process.exit(1);
});
