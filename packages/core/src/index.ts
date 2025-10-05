export { roll } from './dice.js';
export type { RollOptions, RollResult } from './dice.js';
export {
  roll4d6DropLowest,
  rollAbilityScores,
  standardArray,
  calculatePointBuyCost,
  validatePointBuy,
} from './abilityScores.js';
export type {
  AbilityName,
  AbilityScores,
  AbilityRollOptions,
  PointBuyOptions,
} from './abilityScores.js';
export { abilityCheck, savingThrow } from './checks.js';
export type { CheckOptions, CheckResult } from './checks.js';
export { attackRoll, damageRoll, resolveAttack } from './combat.js';
export type {
  AttackRollOptions,
  AttackRollResult,
  DamageRollOptions,
  DamageRollResult,
  ResolveAttackOptions,
  ResolveAttackResult,
} from './combat.js';
export {
  addCondition,
  removeCondition,
  hasCondition,
  combineAdvantage,
  attackAdvFromConditions,
} from './conditions.js';
export type { Condition, ConditionSet } from './conditions.js';
export {
  chooseAttackAbility,
  resolveWeaponAttack,
} from './weapons.js';
export type {
  Weapon,
  WeaponCategory,
  WeaponType,
  DamageType,
  AbilityMods,
  Proficiencies,
  WeaponAttackInput,
} from './weapons.js';
export {
  abilityMod,
  proficiencyBonusForLevel,
  abilityMods,
  derivedAC,
  derivedMaxHP,
  derivedDefaultWeaponProfile,
  isProficientSave,
  isProficientSkill,
  skillAbility,
  hasExpertise,
  characterAbilityCheck,
  characterSavingThrow,
  characterSkillCheck,
  characterWeaponAttack,
  passivePerception,
  setCharacterWeaponLookup,
  setCharacterArmorData,
} from './character.js';
export type {
  Character,
  CharacterAbilityScores,
  CharacterProficiencies,
  Equipped,
  SkillName,
} from './character.js';
export { SKILL_ABILITY } from './skills.js';
export {
  createEncounter,
  addActor,
  removeActor,
  rollInitiative,
  nextTurn,
  currentActor,
  actorAttack,
  setCondition,
  clearCondition,
  recordLoot,
  recordXP,
} from './encounter.js';
export type {
  EncounterState,
  Actor,
  ActorBase,
  MonsterActor,
  PlayerActor,
  InitiativeEntry,
  WeaponProfile,
  Side,
} from './encounter.js';
export { rollCoinsForCR, xpForCR, totalXP } from './loot.js';
export type { CoinBundle, LootRoll } from './loot.js';
export { castSpell, chooseCastingAbility, spellSaveDC } from './spells.js';
export type { CastOptions, CastResult, NormalizedSpell } from './spells.js';
