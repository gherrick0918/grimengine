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
  normalizeCharacter,
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
  ensureSlots,
  canSpendSlot,
  spendSlot,
  restoreAllSlots,
  setSlots,
} from './character.js';
export type {
  Character,
  CharacterAbilityScores,
  CharacterProficiencies,
  Equipped,
  CharacterHitPoints,
  CharacterSenses,
  SkillName,
  SpellSlots,
} from './character.js';
export { SKILL_ABILITY } from './skills.js';
export {
  createEncounter,
  addActor,
  removeActor,
  rollInitiative,
  nextTurn,
  previousTurn,
  currentActor,
  actorAttack,
  encounterAbilityCheck,
  setCondition,
  clearCondition,
  addActorTag,
  removeActorTag,
  clearActorTags,
  expireActorTags,
  clearAllConcentration,
  recordLoot,
  recordXP,
  startConcentration,
  endConcentration,
  getConcentration,
  concentrationDCFromDamage,
} from './encounter.js';
export { concentrationReminderLinesForDamage } from './concentrationReminders.js';
export type {
  EncounterState,
  Actor,
  ActorBase,
  ActorTag,
  ActorTagDuration,
  MonsterActor,
  PlayerActor,
  InitiativeEntry,
  WeaponProfile,
  Side,
  ConcentrationEntry,
  EncounterCheckInput,
} from './encounter.js';
export { rollCoinsForCR, xpForCR, totalXP } from './loot.js';
export type { CoinBundle, LootRoll } from './loot.js';
export { castSpell, chooseCastingAbility, spellSaveDC, diceForCharacterLevel, diceForSlotLevel } from './spells.js';
export type { CastOptions, CastResult, NormalizedSpell } from './spells.js';
export { startHuntersMark, endHuntersMark } from './spells/huntersMark.js';
export { startBless, endBless } from './spells/bless.js';
export { startGuidance, endGuidance } from './spells/guidance.js';
export {
  applyBardicInspiration,
  clearBardicInspiration,
  hasBardicInspiration,
  bardicInspirationDieFromTag,
  getBardicInspirationTag,
  bardicInspirationAutoClears,
  consumeBardicInspiration,
} from './features/bardicInspiration.js';
export { remindersFor } from './reminders.js';
export type { ReminderEvent } from './reminders.js';
export { computeAdvantageState } from './advantage.js';
export type { AdvantageState, AttackMode } from './advantage.js';
