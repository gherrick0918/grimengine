import type { AbilityName } from './abilityScores.js';
import { abilityCheck, savingThrow } from './checks.js';
import type { ResolveAttackResult } from './combat.js';
import { resolveWeaponAttack, type Proficiencies as WeaponProficiencies, type Weapon } from './weapons.js';

export type SkillName =
  | 'Acrobatics'
  | 'Animal Handling'
  | 'Arcana'
  | 'Athletics'
  | 'Deception'
  | 'History'
  | 'Insight'
  | 'Intimidation'
  | 'Investigation'
  | 'Medicine'
  | 'Nature'
  | 'Perception'
  | 'Performance'
  | 'Persuasion'
  | 'Religion'
  | 'Sleight of Hand'
  | 'Stealth'
  | 'Survival';

export interface CharacterAbilityScores {
  STR: number;
  DEX: number;
  CON: number;
  INT: number;
  WIS: number;
  CHA: number;
}

export type AbilityMods = Record<AbilityName, number>;

export interface CharacterProficiencies {
  weapons?: WeaponProficiencies;
  saves?: AbilityName[];
  skills?: SkillName[];
}

export interface Character {
  name: string;
  level: number;
  abilities: CharacterAbilityScores;
  proficiencies?: CharacterProficiencies;
}

type WeaponLookup = (name: string) => Weapon | undefined;

let weaponLookup: WeaponLookup | undefined;

export function setCharacterWeaponLookup(lookup: WeaponLookup | undefined): void {
  weaponLookup = lookup;
}

export function abilityMod(score: number): number {
  if (!Number.isFinite(score)) {
    throw new Error(`Invalid ability score: ${score}`);
  }
  return Math.floor((score - 10) / 2);
}

const PROFICIENCY_TABLE: { maxLevel: number; bonus: number }[] = [
  { maxLevel: 4, bonus: 2 },
  { maxLevel: 8, bonus: 3 },
  { maxLevel: 12, bonus: 4 },
  { maxLevel: 16, bonus: 5 },
  { maxLevel: 20, bonus: 6 },
];

export function proficiencyBonusForLevel(level: number): number {
  if (!Number.isFinite(level) || level < 1) {
    throw new Error(`Invalid level ${level}. Level must be between 1 and 20.`);
  }

  for (const entry of PROFICIENCY_TABLE) {
    if (level <= entry.maxLevel) {
      return entry.bonus;
    }
  }

  return PROFICIENCY_TABLE[PROFICIENCY_TABLE.length - 1]?.bonus ?? 6;
}

export function abilityMods(abilities: CharacterAbilityScores): AbilityMods {
  return {
    STR: abilityMod(abilities.STR),
    DEX: abilityMod(abilities.DEX),
    CON: abilityMod(abilities.CON),
    INT: abilityMod(abilities.INT),
    WIS: abilityMod(abilities.WIS),
    CHA: abilityMod(abilities.CHA),
  };
}

export function isProficientSave(character: Character, ability: AbilityName): boolean {
  return Boolean(character.proficiencies?.saves?.includes(ability));
}

export function isProficientSkill(character: Character, skill: SkillName): boolean {
  return Boolean(character.proficiencies?.skills?.includes(skill));
}

function resolveCharacterAbilityModifier(
  character: Character,
  ability: AbilityName,
  extraMod: number,
): number {
  const mods = abilityMods(character.abilities);
  return mods[ability] + extraMod;
}

export function characterAbilityCheck(
  character: Character,
  ability: AbilityName,
  opts: {
    dc?: number;
    advantage?: boolean;
    disadvantage?: boolean;
    seed?: string;
    extraMod?: number;
  } = {},
) {
  const { dc, advantage, disadvantage, seed, extraMod = 0 } = opts;
  const modifier = resolveCharacterAbilityModifier(character, ability, extraMod);

  return abilityCheck({
    ability,
    modifier,
    advantage,
    disadvantage,
    dc,
    seed,
  });
}

export function characterSavingThrow(
  character: Character,
  ability: AbilityName,
  opts: {
    dc?: number;
    advantage?: boolean;
    disadvantage?: boolean;
    seed?: string;
    extraMod?: number;
  } = {},
) {
  const { dc, advantage, disadvantage, seed, extraMod = 0 } = opts;
  const modifier = resolveCharacterAbilityModifier(character, ability, extraMod);
  const proficient = isProficientSave(character, ability);
  const proficiencyBonus = proficiencyBonusForLevel(character.level);

  return savingThrow({
    ability,
    modifier,
    proficient,
    proficiencyBonus,
    advantage,
    disadvantage,
    dc,
    seed,
  });
}

function requireWeapon(name: string): Weapon {
  if (!weaponLookup) {
    throw new Error('No weapon lookup configured for character attacks.');
  }
  const weapon = weaponLookup(name);
  if (!weapon) {
    throw new Error(`Unknown weapon: ${name}`);
  }
  return weapon;
}

export function characterWeaponAttack(
  character: Character,
  weaponName: string,
  opts: {
    twoHanded?: boolean;
    advantage?: boolean;
    disadvantage?: boolean;
    targetAC?: number;
    seed?: string;
  } = {},
): ResolveAttackResult {
  const weapon = requireWeapon(weaponName);
  const abilityModifiers = abilityMods(character.abilities);
  const proficiencyBonus = proficiencyBonusForLevel(character.level);

  return resolveWeaponAttack({
    weapon,
    abilities: abilityModifiers,
    proficiencies: character.proficiencies?.weapons,
    proficiencyBonus,
    twoHanded: opts.twoHanded,
    advantage: opts.advantage,
    disadvantage: opts.disadvantage,
    targetAC: opts.targetAC,
    seed: opts.seed,
  });
}
