import type { ResolveAttackResult } from './combat.js';
import { resolveAttack } from './combat.js';

export type WeaponCategory = 'simple' | 'martial';
export type WeaponType = 'melee' | 'ranged';
export type DamageType = 'slashing' | 'piercing' | 'bludgeoning';
export type AbilityName = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';

export interface Weapon {
  name: string;
  category: WeaponCategory;
  type: WeaponType;
  damage: { expression: string; type: DamageType };
  versatile?: { expression: string };
  properties?: {
    finesse?: boolean;
    light?: boolean;
    heavy?: boolean;
    thrown?: { normal: number; long: number } | true;
    reach?: boolean;
    twoHanded?: boolean;
    ammunition?: boolean;
    loading?: boolean;
  };
  range?: { normal: number; long?: number };
}

export interface AbilityMods {
  STR?: number;
  DEX?: number;
  CON?: number;
  INT?: number;
  WIS?: number;
  CHA?: number;
}

export interface Proficiencies {
  simple?: boolean;
  martial?: boolean;
}

export interface WeaponAttackInput {
  weapon: Weapon;
  abilities: AbilityMods;
  proficiencies?: Proficiencies;
  proficiencyBonus?: number;
  twoHanded?: boolean;
  advantage?: boolean;
  disadvantage?: boolean;
  targetAC?: number;
  seed?: string;
}

const DEFAULT_ABILITY: AbilityName = 'STR';

function getAbilityValue(abilities: AbilityMods, ability: AbilityName): number {
  const value = abilities[ability];
  return typeof value === 'number' ? value : 0;
}

function applyAbilityModifier(expression: string, modifier: number): string {
  const trimmed = expression.trim();
  if (modifier === 0) {
    return trimmed;
  }

  const cleaned = trimmed.replace(/([+-])0$/, '');
  const sign = modifier >= 0 ? '+' : '';
  return `${cleaned}${sign}${modifier}`;
}

export function chooseAttackAbility(
  weapon: Weapon,
  abilities: AbilityMods,
  opts?: { thrown?: boolean },
): AbilityName {
  const treatingAsRanged = weapon.type === 'ranged' && !opts?.thrown;

  if (treatingAsRanged) {
    return 'DEX';
  }

  const finesse = weapon.properties?.finesse === true;
  const str = getAbilityValue(abilities, 'STR');
  const dex = getAbilityValue(abilities, 'DEX');

  if (finesse && dex > str) {
    return 'DEX';
  }

  return DEFAULT_ABILITY;
}

export function resolveWeaponAttack(input: WeaponAttackInput): ResolveAttackResult {
  const { weapon, abilities, proficiencies, proficiencyBonus, twoHanded, advantage, disadvantage, targetAC, seed } =
    input;

  const ability = chooseAttackAbility(weapon, abilities);
  const abilityMod = getAbilityValue(abilities, ability);
  const proficient = Boolean(proficiencies?.[weapon.category]);

  const damageExpressionBase = twoHanded && weapon.versatile ? weapon.versatile.expression : weapon.damage.expression;
  const damageExpression = applyAbilityModifier(damageExpressionBase, abilityMod);

  return resolveAttack({
    abilityMod,
    proficient,
    proficiencyBonus,
    advantage,
    disadvantage,
    targetAC,
    seed,
    damage: {
      expression: damageExpression,
      seed,
    },
  });
}
