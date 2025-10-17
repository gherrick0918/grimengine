import { readFileSync, promises as fs } from 'node:fs';
import { basename, relative } from 'node:path';

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
  castSpell,
  chooseCastingAbility,
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
  ensureSlots,
  canSpendSlot,
  setSlots,
  restoreAllSlots,
  derivedAC,
  derivedMaxHP,
  derivedDefaultWeaponProfile,
  normalizeCharacter,
  SKILL_ABILITY,
  createEncounter,
  addActor as addEncounterActor,
  removeActor as removeEncounterActor,
  rollInitiative as rollEncounterInitiative,
  setInitiative as setEncounterInitiative,
  clearInitiative as clearEncounterInitiative,
  nextTurn as encounterNextTurn,
  previousTurn as encounterPreviousTurn,
  currentActor as encounterCurrentActor,
  actorAttack as encounterActorAttack,
  encounterAbilityCheck,
  setCondition as encounterSetCondition,
  clearCondition as encounterClearCondition,
  addActorTag as encounterAddActorTag,
  removeActorTag as encounterRemoveActorTag,
  clearActorTags as encounterClearActorTags,
  clearAllConcentration,
  clearStatusEffects as encounterClearStatusEffects,
  shortRest as encounterShortRest,
  longRest as encounterLongRest,
  combineAdvantage,
  attackAdvFromConditions,
  computeAdvantageState,
  hasCondition,
  recordLoot as encounterRecordLoot,
  recordXP as encounterRecordXP,
  startConcentration,
  endConcentration,
  getConcentration,
  startBless,
  startHuntersMark,
  startGuidance,
  applyBardicInspiration,
  clearBardicInspiration,
  hasBardicInspiration,
  bardicInspirationDieFromTag,
  consumeBardicInspiration,
  remindersFor,
  concentrationDCFromDamage,
  concentrationReminderLinesForDamage,
  listBag,
  listInv,
  giveToParty,
  giveToActor,
  takeFromParty,
  takeFromActor,
  rollCoinsForCR,
  totalXP,
  applyDamage,
  applyHealing,
  getDeath,
  getCurrentHp,
  rollDeathSave,
  type EncounterState,
  type Actor as EncounterActor,
  type ConcentrationEntry,
  type ActorTag,
  type PlayerActor,
  type MonsterActor,
  type Side,
  type WeaponProfile,
  type AbilityName,
  type AttackRollResult,
  type AbilityMods,
  type Proficiencies,
  type Weapon,
  type Character,
  type SpellSlots,
  type SkillName,
  type CoinBundle,
  type InventoryItem,
  type CastResult,
  type Condition,
  type ReminderEvent,
  resolveLogFile,
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
import {
  getSpell as fetchSpell,
  listCachedSpells as listCachedSpellsRaw,
  readCachedSpell as readCachedSpellRaw,
  spellCachePath,
} from '@grimengine/dnd5e-api/spells.js';
import type { NormalizedSpell } from '@grimengine/dnd5e-api/spells.js';
import { clearEncounter, loadEncounter, saveEncounter } from './encounterSession';
import { deleteEncounterByName, listEncounterSaves, loadEncounterByName, saveEncounterAs } from './enc-session';
import { clearCharacter, loadCharacter, saveCharacter } from './session';
import { loadSettings, saveSettings } from './settings';
import { listVaultNames, loadFromVault, saveToVault } from './char-vault';
import {
  addMonsters,
  buildEncounterFromSpec,
  generateActorId,
  importMonsters as importCompendiumMonsters,
  readIndex as readCompendiumIndex,
  resolveCompendiumTemplate,
  seedBasic as seedCompendiumBasic,
  summarizeTemplate,
} from './compendium';
import {
  appendCampaignNote,
  createCampaign,
  formatCampaignParty,
  guessCurrentCampaignFile,
  loadCampaignByName,
  readCampaignFile,
  relativeSnapshotPath,
  resolveSnapshotAbsolutePath,
  snapshotLabel,
  writeCampaignFile,
} from './lib/campaigns';
import { getActorIdByName } from './lib/resolve';
import { currentCampaignForLogging, logIfEnabled } from './logging';
import { LootTableNotFoundError, rollLootIntoEncounter } from './loot';

const SAMPLE_MONSTER_TYPES = {
  goblin: 'Goblin',
  bandit: 'Bandit',
  skeleton: 'Skeleton',
} as const;

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
  console.log('  pnpm dev -- settings get');
  console.log('  pnpm dev -- settings set respect-adv <on|off>');
  console.log('  pnpm dev -- settings set auto-log <on|off>');
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
  console.log('  pnpm dev -- compendium seed srd-basic');
  console.log('  pnpm dev -- compendium import "<path>"');
  console.log('  pnpm dev -- compendium stats "<slug-or-name>"');
  console.log('  pnpm dev -- spell fetch "<name>"');
  console.log('  pnpm dev -- spell list');
  console.log('  pnpm dev -- spell show "<name>"');
  console.log('  pnpm dev -- hm "<TargetName>"');
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
  console.log('  pnpm dev -- character slots show');
  console.log('  pnpm dev -- character slots set "<L=X,...>"');
  console.log('  pnpm dev -- character rest long');
  console.log('  pnpm dev -- character rest short');
  console.log('  pnpm dev -- character attack "<name>" [--twohanded] [--ac <n>] [--adv|--dis] [--seed <value>]');
  console.log(
    '  pnpm dev -- character cast "<spell>" [--ability INT|WIS|CHA] [--target "<id|name>"] [--seed <value>] [--melee|--ranged] [--slotLevel <n>]'
  );
  console.log('  pnpm dev -- character equip [--armor "<ArmorName>"] [--shield on|off] [--weapon "<WeaponName>"] [--hitdie d6|d8|d10|d12]');
  console.log('  pnpm dev -- character set [--level <n>]');
  console.log('  pnpm dev -- character add-xp <n>');
  console.log('  pnpm dev -- character unload');
  console.log('  pnpm dev -- encounter start [--seed <value>]');
  console.log('  pnpm dev -- encounter add pc "<name>"');
  console.log('  pnpm dev -- encounter add monster "<name>" [--count <n>]');
  console.log('  pnpm dev -- inventory list [Who]');
  console.log('  pnpm dev -- inventory give <Who> "<Item>" <Qty>');
  console.log('  pnpm dev -- inventory take <Who> "<Item>" <Qty>');
  console.log('  pnpm dev -- inventory drop "<Item>" <Qty>');
  console.log('  pnpm dev -- loot roll "<Table>" [--into <party|actorName>]');
  console.log('  pnpm dev -- session tail [--n <lines>]');
  console.log(
    '  pnpm dev -- encounter add <goblin|bandit|skeleton> [--n <count>] [--name <BaseName>] [--side <party|foe|neutral>]',
  );
  console.log('  pnpm dev -- encounter build "<Spec>" [--side <party|foe|neutral>]');
  console.log('  pnpm dev -- encounter damage "<Name>" <amount>');
  console.log('  pnpm dev -- encounter heal "<Name>" <amount>');
  console.log('  pnpm dev -- encounter adv "<Name>" <on|off>');
  console.log('  pnpm dev -- encounter dis "<Name>" <on|off>');
  console.log('  pnpm dev -- encounter list');
  console.log('  pnpm dev -- encounter clear <Who>');
  console.log('  pnpm dev -- encounter save "<name>"');
  console.log('  pnpm dev -- encounter ls');
  console.log('  pnpm dev -- encounter load "<name>"');
  console.log('  pnpm dev -- encounter delete "<name>"');
  console.log('  pnpm dev -- encounter rest long [--who <Name|party|foe|neutral>]');
  console.log('  pnpm dev -- encounter rest short [--who <Name|party|foe|neutral>] [--hd <n>]');
  console.log('  pnpm dev -- encounter init roll');
  console.log('  pnpm dev -- encounter init set "<Name>" <Score>');
  console.log('  pnpm dev -- encounter init show');
  console.log('  pnpm dev -- encounter init clear');
  console.log('  pnpm dev -- encounter next');
  console.log('  pnpm dev -- encounter prev');
  console.log(
    '  pnpm dev -- encounter check "<actorIdOrName>" <ABILITY> [--dc <n>] [--skill "<SkillName>"] [--adv|--dis] [--seed <value>]',
  );
  console.log('  pnpm dev -- encounter attack "<attacker>" "<defender>" [--mode melee|ranged] [--adv|--dis] [--twohanded] [--respect-adv] [--seed <value>]');
  console.log('  pnpm dev -- death save "<Name>"');
  console.log('  pnpm dev -- stabilize "<Name>"');
  console.log('  pnpm dev -- encounter concentration start "<casterIdOrName>" "<Spell Name>" [--target "<id|name>"]');
  console.log('  pnpm dev -- encounter concentration end "<casterIdOrName>"');
  console.log('  pnpm dev -- encounter concentration check "<casterIdOrName>" <damage> [--seed <value>]');
  console.log('  pnpm dev -- encounter mark "<rangerIdOrName>" "<targetIdOrName>" [--note "<detail>"]');
  console.log('  pnpm dev -- encounter bless "<casterIdOrName>" "A,B,C"');
  console.log('  pnpm dev -- encounter guidance "<casterIdOrName>" "<targetIdOrName>"');
  console.log(
    '  pnpm dev -- encounter inspire "<bardIdOrName>" "<targetIdOrName>" [--die d6|d8|d10|d12] [--auto-clear]'
  );
  console.log('  pnpm dev -- encounter inspire use "<targetIdOrName>"');
  console.log('  pnpm dev -- encounter inspire-clear "<targetIdOrName>"');
  console.log('  pnpm dev -- encounter remind "<Attacker>" ["<Target>"] [--event attack|save|check]');
  console.log('  pnpm dev -- encounter prone "<actorIdOrName>" <on|off>');
  console.log('  pnpm dev -- encounter restrained "<actorIdOrName>" <on|off>');
  console.log('  pnpm dev -- encounter invisible "<actorIdOrName>" <on|off>');
  console.log('  pnpm dev -- encounter condition add "<actorIdOrName>" <condition>');
  console.log('  pnpm dev -- encounter condition remove "<actorIdOrName>" <condition>');
  console.log('  pnpm dev -- encounter condition list');
  console.log('  pnpm dev -- encounter note add "<actorIdOrName>" "<text>" [--rounds N] [--note "<detail>"] [--source "<who/what>"]');
  console.log('  pnpm dev -- encounter note list');
  console.log('  pnpm dev -- encounter note remove "<actorIdOrName>" <tagId>');
  console.log('  pnpm dev -- encounter note clear "<actorIdOrName>"');
  console.log('  pnpm dev -- encounter loot [--seed <value>] [--items <n>] [--note "<text>"]');
  console.log('  pnpm dev -- encounter xp [--party <n>]');
  console.log('  pnpm dev -- encounter end');
}

function formatSpellLevel(level: number): string {
  return level === 0 ? 'Cantrip' : `Level ${level}`;
}

function formatSpellMechanics(spell: NormalizedSpell): string {
  const parts: string[] = [];
  if (spell.attackType) {
    parts.push(`${spell.attackType} spell attack`);
  }
  if (spell.save) {
    const successLabel = spell.save.onSuccess === 'half' ? 'half on success' : 'none on success';
    parts.push(`${spell.save.ability} save (${successLabel})`);
  }
  return parts.length > 0 ? parts.join(' | ') : '—';
}

function formatSpellDamage(spell: NormalizedSpell): string {
  if (!spell.damageDice) {
    return '—';
  }
  const typeLabel = spell.damageType ? ` ${spell.damageType.toLowerCase()}` : '';
  return `${spell.damageDice}${typeLabel}`;
}

function printSpellDetails(spell: NormalizedSpell): void {
  console.log(`${spell.name} — ${formatSpellLevel(spell.level)}`);
  console.log(`Mechanic: ${formatSpellMechanics(spell)}`);
  console.log(`Damage: ${formatSpellDamage(spell)}`);
  if (spell.info?.range) {
    console.log(`Range: ${spell.info.range}`);
  }
  if (spell.info?.casting_time) {
    console.log(`Casting Time: ${spell.info.casting_time}`);
  }
  if (spell.info?.concentration || spell.info?.ritual) {
    const tags: string[] = [];
    if (spell.info.concentration) {
      tags.push('Concentration');
    }
    if (spell.info.ritual) {
      tags.push('Ritual');
    }
    console.log(`Tags: ${tags.join(', ')}`);
  }
}

function printSlotTable(slots: SpellSlots): void {
  const rows: Array<{ level: number; max: number; remaining: number }> = [];
  for (let level = 1; level <= 9; level += 1) {
    const max = slots.max[level] ?? 0;
    const remaining = slots.remaining[level] ?? 0;
    if (max > 0) {
      rows.push({ level, max, remaining });
    }
  }

  if (rows.length === 0) {
    console.log('No spell slots configured.');
    return;
  }

  console.log('Spell Slots:');
  console.log('Level | Max | Remaining');
  console.log('----- | --- | ---------');
  rows.forEach(({ level, max, remaining }) => {
    const levelLabel = level.toString().padStart(5, ' ');
    const maxLabel = max.toString().padStart(3, ' ');
    const remainingLabel = remaining.toString().padStart(9, ' ');
    console.log(`${levelLabel} | ${maxLabel} | ${remainingLabel}`);
  });
}

function parseSlotSpec(spec: string): Partial<Record<number, number>> {
  const updates: Partial<Record<number, number>> = {};
  const parts = spec.split(',');
  for (const rawPart of parts) {
    const part = rawPart.trim();
    if (!part) {
      continue;
    }
    const [levelRaw, valueRaw] = part.split('=');
    if (valueRaw === undefined) {
      throw new Error(`Invalid slot spec segment "${part}". Expected format L=X.`);
    }
    const level = Number.parseInt(levelRaw, 10);
    const value = Number.parseInt(valueRaw, 10);
    if (!Number.isFinite(level) || level < 1 || level > 9) {
      throw new Error(`Invalid slot level "${levelRaw}". Levels must be 1-9.`);
    }
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`Invalid slot value "${valueRaw}". Values must be non-negative integers.`);
    }
    updates[level] = value;
  }
  if (Object.keys(updates).length === 0) {
    throw new Error('No slot assignments found. Provide values like "1=4,2=3".');
  }
  return updates;
}

function cachedSpellDisplayName(slug: string): string {
  try {
    const data = readCachedSpellRaw(slug);
    if (data && typeof data === 'object' && typeof (data as { name?: unknown }).name === 'string') {
      return (data as { name: string }).name;
    }
  } catch {
    // ignore
  }
  return slug;
}

async function handleSpellFetchCommand(name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) {
    console.error('Spell name is required.');
    process.exit(1);
  }

  try {
    const spell = await fetchSpell(trimmed);
    printSpellDetails(spell);
    console.log(`Cached at ${spellCachePath(trimmed)}`);
    process.exit(0);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Failed to fetch spell: ${error.message}`);
    } else {
      console.error('Failed to fetch spell.');
    }
    process.exit(1);
  }
}

function handleSpellListCommand(): void {
  const slugs = listCachedSpellsRaw();
  if (slugs.length === 0) {
    console.log('No cached spells.');
    process.exit(0);
  }

  console.log('Cached spells:');
  slugs.forEach((slug) => {
    console.log(`- ${cachedSpellDisplayName(slug)} (${slug})`);
  });
  process.exit(0);
}

async function handleSpellShowCommand(name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) {
    console.error('Spell name is required.');
    process.exit(1);
  }

  try {
    const spell = await fetchSpell(trimmed);
    printSpellDetails(spell);
    process.exit(0);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Failed to load spell: ${error.message}`);
    } else {
      console.error('Failed to load spell.');
    }
    process.exit(1);
  }
}

async function handleSpellCommand(rawArgs: string[]): Promise<void> {
  if (rawArgs.length === 0) {
    console.error('Missing spell subcommand.');
    showUsage();
    process.exit(1);
  }

  const [subcommand, ...rest] = rawArgs;

  if (subcommand === 'fetch') {
    if (rest.length === 0) {
      console.error('Missing spell name for fetch command.');
      process.exit(1);
    }
    await handleSpellFetchCommand(rest[0]);
    return;
  }

  if (subcommand === 'list') {
    handleSpellListCommand();
    return;
  }

  if (subcommand === 'show') {
    if (rest.length === 0) {
      console.error('Missing spell name for show command.');
      process.exit(1);
    }
    await handleSpellShowCommand(rest[0]);
    return;
  }

  console.error(`Unknown spell subcommand: ${subcommand}`);
  process.exit(1);
}

const ABILITY_NAMES: AbilityName[] = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
const SKILL_NAMES = Object.keys(SKILL_ABILITY) as SkillName[];
const CONDITION_NAMES: Condition[] = ['prone', 'restrained', 'poisoned', 'grappled', 'invisible'];

function isAbilityName(value: string): value is AbilityName {
  return ABILITY_NAMES.includes(value as AbilityName);
}

function normalizeSkillName(raw: string): SkillName | undefined {
  const target = raw.trim().toLowerCase();
  return SKILL_NAMES.find((skill) => skill.toLowerCase() === target);
}

function parseConditionName(raw: string): Condition | undefined {
  const target = raw.trim().toLowerCase();
  return CONDITION_NAMES.find((condition) => condition === target);
}

const REMINDER_EVENTS: ReminderEvent[] = ['attack', 'save', 'check'];

function parseReminderEvent(raw: string): ReminderEvent | undefined {
  const normalized = raw.trim().toLowerCase();
  return REMINDER_EVENTS.find((event) => event === normalized);
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

function printInventory(label: string, items: InventoryItem[], emptyMessage: string): void {
  if (items.length === 0) {
    console.log(emptyMessage);
    return;
  }
  console.log(`${label}:`);
  items.forEach((item) => {
    console.log(`- ${item.name} x${item.qty}`);
  });
}

function parseInventoryTransferArgs(args: string[]): { who: string; item: string; qty: number } {
  if (args.length < 3) {
    throw new Error('Usage: pnpm dev -- inventory <give|take> <Who> "<Item>" <Qty>');
  }
  const who = args[0]!;
  const qtyRaw = args[args.length - 1]!;
  const item = args.slice(1, -1).join(' ').trim();
  if (!item) {
    throw new Error('Item name is required.');
  }
  const qty = parsePositiveInteger(qtyRaw, 'Quantity');
  return { who, item, qty };
}

function parseDropArgs(args: string[]): { item: string; qty: number } {
  if (args.length < 2) {
    throw new Error('Usage: pnpm dev -- inventory drop "<Item>" <Qty>');
  }
  const qtyRaw = args[args.length - 1]!;
  const item = args.slice(0, -1).join(' ').trim();
  if (!item) {
    throw new Error('Item name is required.');
  }
  const qty = parsePositiveInteger(qtyRaw, 'Quantity');
  return { item, qty };
}

function handleInventoryListCommand(args: string[]): void {
  const encounter = loadEncounter();
  if (!encounter) {
    console.log('No encounter in progress.');
    process.exit(0);
  }

  const targetRaw = args.join(' ').trim();
  const normalized = targetRaw.toLowerCase();

  if (!targetRaw || normalized === 'party' || normalized === 'bag') {
    const items = listBag(encounter);
    printInventory('Party bag', items, 'Party bag is empty.');
    process.exit(0);
    return;
  }

  let actorId: string;
  try {
    actorId = getActorIdByName(encounter, targetRaw);
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(String(error));
    }
    process.exit(1);
    return;
  }

  const actor = encounter.actors[actorId];
  const items = listInv(encounter, actorId);
  const label = actor ? `Inventory for ${actor.name}` : `Inventory for ${targetRaw}`;
  const emptyMessage = actor ? `${actor.name} has no items.` : `${targetRaw} has no items.`;
  printInventory(label, items, emptyMessage);
  process.exit(0);
}

function handleInventoryGiveCommand(args: string[]): void {
  let parsed;
  try {
    parsed = parseInventoryTransferArgs(args);
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
    return;
  }

  const { who, item, qty } = parsed;
  const encounter = requireEncounterState();
  const normalized = who.trim().toLowerCase();

  if (normalized === 'party' || normalized === 'bag') {
    giveToParty(encounter, item, qty);
    saveEncounter(encounter);
    console.log(`Gave ${item} x${qty} to the party bag.`);
    process.exit(0);
    return;
  }

  let actorId: string;
  try {
    actorId = getActorIdByName(encounter, who);
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(String(error));
    }
    process.exit(1);
    return;
  }

  giveToActor(encounter, actorId, item, qty);
  saveEncounter(encounter);
  const actorName = encounter.actors[actorId]?.name ?? who;
  console.log(`Gave ${item} x${qty} to ${actorName}.`);
  process.exit(0);
}

function handleInventoryTakeCommand(args: string[]): void {
  let parsed;
  try {
    parsed = parseInventoryTransferArgs(args);
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
    return;
  }

  const { who, item, qty } = parsed;
  const encounter = requireEncounterState();
  const normalized = who.trim().toLowerCase();

  if (normalized === 'party' || normalized === 'bag') {
    const removed = takeFromParty(encounter, item, qty);
    if (removed > 0) {
      saveEncounter(encounter);
    }
    console.log(`Took ${item} x${removed} from the party bag.`);
    process.exit(0);
    return;
  }

  let actorId: string;
  try {
    actorId = getActorIdByName(encounter, who);
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(String(error));
    }
    process.exit(1);
    return;
  }

  const removed = takeFromActor(encounter, actorId, item, qty);
  if (removed > 0) {
    saveEncounter(encounter);
  }
  const actorName = encounter.actors[actorId]?.name ?? who;
  console.log(`Took ${item} x${removed} from ${actorName}.`);
  process.exit(0);
}

function handleInventoryDropCommand(args: string[]): void {
  let parsed;
  try {
    parsed = parseDropArgs(args);
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
    return;
  }

  const { item, qty } = parsed;
  const encounter = requireEncounterState();
  const removed = takeFromParty(encounter, item, qty);
  if (removed > 0) {
    saveEncounter(encounter);
  }
  if (removed === 0) {
    console.log(`No ${item} found in the party bag.`);
  } else {
    console.log(`Dropped ${item} x${removed} from the party bag.`);
  }
  process.exit(0);
}

function parseLootRollArgs(args: string[]): { table: string; into?: string } {
  if (args.length === 0) {
    throw new Error('Usage: pnpm dev -- loot roll "<Table>" [--into <party|actorName>]');
  }

  const parts: string[] = [];
  let into: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index]!;
    if (token === '--into') {
      if (into) {
        throw new Error('Duplicate --into option.');
      }
      const value = args[index + 1];
      if (!value) {
        throw new Error('Missing target after --into.');
      }
      into = value;
      index += 1;
      continue;
    }
    parts.push(token);
  }

  const table = parts.join(' ').trim();
  if (!table) {
    throw new Error('Table name is required.');
  }

  return { table, into };
}

async function handleLootRollCommand(args: string[]): Promise<void> {
  let parsed: { table: string; into?: string };
  try {
    parsed = parseLootRollArgs(args);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
    return;
  }

  const encounter = requireEncounterState();
  const { table, into } = parsed;

  let target: 'party' | { actorId: string; label: string };
  if (!into || into.trim().toLowerCase() === 'party' || into.trim().toLowerCase() === 'party bag') {
    target = 'party';
  } else {
    try {
      const actorId = getActorIdByName(encounter, into);
      const actorName = encounter.actors[actorId]?.name ?? into;
      target = { actorId, label: actorName };
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
      return;
    }
  }

  try {
    const receipt = await rollLootIntoEncounter(table, encounter, {
      baseDir: process.cwd(),
      into: target,
    });
    saveEncounter(encounter);
    const summary =
      receipt.items.length > 0
        ? receipt.items.map((item) => `${item.label} x${item.qty}`).join(', ')
        : 'nothing';
    console.log(`Loot: ${receipt.table} → ${summary} (to: ${receipt.target})`);
    process.exit(0);
  } catch (error) {
    if (error instanceof LootTableNotFoundError) {
      const available = error.available;
      const prefix = `Loot table "${error.table}" not found. Run 'pnpm run seed:loot' to install starter tables.`;
      if (available.length > 0) {
        console.log(`${prefix} Available tables: ${available.join(', ')}`);
      } else {
        console.log(prefix);
      }
      process.exit(0);
      return;
    }
    if (error instanceof Error) {
      console.error(`Failed to roll loot table "${table}": ${error.message}`);
    } else {
      console.error(`Failed to roll loot table "${table}": ${String(error)}`);
    }
    process.exit(1);
  }
}

async function handleLootCommand(args: string[]): Promise<void> {
  if (args.length === 0) {
    console.error('Missing loot subcommand.');
    process.exit(1);
    return;
  }

  const [subcommand, ...rest] = args;
  if (subcommand === 'roll') {
    await handleLootRollCommand(rest);
    return;
  }

  if (subcommand === 'seed') {
    console.log("Loot seeding is now handled by 'pnpm run seed:loot'.");
    process.exit(0);
    return;
  }

  console.error(`Unknown loot subcommand: ${subcommand}`);
  process.exit(1);
}

async function handleInventoryCommand(args: string[]): Promise<void> {
  if (args.length === 0) {
    console.error('Missing inventory subcommand.');
    process.exit(1);
    return;
  }

  const [subcommand, ...rest] = args;
  const normalized = subcommand.toLowerCase();

  if (normalized === 'list') {
    handleInventoryListCommand(rest);
    return;
  }
  if (normalized === 'give') {
    handleInventoryGiveCommand(rest);
    return;
  }
  if (normalized === 'take') {
    handleInventoryTakeCommand(rest);
    return;
  }
  if (normalized === 'drop') {
    handleInventoryDropCommand(rest);
    return;
  }

  console.error(`Unknown inventory subcommand: ${subcommand}`);
  process.exit(1);
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

function formatHitPoints(actor: EncounterActor): string {
  const current = getCurrentHp(actor);
  const base = `${current}/${actor.maxHp}`;
  if (current > 0) {
    return base;
  }

  const death = actor.death;
  if (!death) {
    return base;
  }
  if (death.dead) {
    return `${base} (DEAD)`;
  }
  if (death.stable) {
    return `${base} (stable)`;
  }
  return `${base} (S:${death.successes} F:${death.failures})`;
}

function cloneEncounterActor(actor: EncounterActor): EncounterActor {
  if (actor.death) {
    return { ...actor, death: { ...actor.death } };
  }
  return { ...actor };
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

const SIDE_SELECTORS: Side[] = ['party', 'foe', 'neutral'];

function collectActorIdsBySelector(state: EncounterState, selector: string): string[] {
  const normalized = selector.trim().toLowerCase();
  if (!normalized) {
    return [];
  }

  if (normalized === 'all') {
    return Object.keys(state.actors);
  }

  if ((SIDE_SELECTORS as string[]).includes(normalized)) {
    return Object.values(state.actors)
      .filter((actor) => actor.side === normalized)
      .map((actor) => actor.id);
  }

  try {
    const actor = findActorByIdentifier(state, selector);
    return [actor.id];
  } catch {
    return [];
  }
}

function handleEncounterClearCommand(rawArgs: string[]): void {
  if (rawArgs.length === 0) {
    console.error("Usage: pnpm dev -- encounter clear <Who>");
    process.exit(1);
  }

  const [selector, ...rest] = rawArgs;
  if (rest.length > 0) {
    console.warn(`Ignoring extra argument(s): ${rest.join(', ')}`);
  }

  const encounter = requireEncounterState();
  const actorIds = collectActorIdsBySelector(encounter, selector ?? '');
  if (actorIds.length === 0) {
    console.error(`No actors found for '${selector}'.`);
    process.exit(1);
  }

  const updated = encounterClearStatusEffects(encounter, actorIds);
  saveEncounter(updated);
  console.log(`Cleared status from ${actorIds.length} actor(s).`);
  process.exit(0);
}

function concentrationTargetSummary(state: EncounterState, entry: ConcentrationEntry): string {
  if (entry.targetIds && entry.targetIds.length > 0) {
    const labels = entry.targetIds
      .map((id) => state.actors[id]?.name ?? id)
      .filter((label) => label && label.length > 0);
    return labels.length > 0 ? labels.join(', ') : entry.targetIds.join(', ');
  }

  if (entry.targetId) {
    const actor = state.actors[entry.targetId];
    return actor ? actor.name : entry.targetId;
  }

  return 'none';
}

function findPcActorByName(state: EncounterState, name: string): PlayerActor | undefined {
  const target = name.trim().toLowerCase();
  return Object.values(state.actors).find(
    (actor): actor is PlayerActor => actor.type === 'pc' && actor.name.toLowerCase() === target,
  );
}

function maybeStartPcConcentration(
  state: EncounterState,
  character: Character,
  spell: NormalizedSpell,
  target?: EncounterActor,
): { state: EncounterState; caster: PlayerActor; entry: { casterId: string; spellName: string; targetId?: string } } | null {
  const casterActor = findPcActorByName(state, character.name);
  if (!casterActor) {
    return null;
  }

  const entry = {
    casterId: casterActor.id,
    spellName: spell.name,
    targetId: target?.id,
  };

  const nextState = startConcentration(state, entry);
  return { state: nextState, caster: casterActor, entry };
}

async function handleHuntersMarkCommand(rawArgs: string[]): Promise<void> {
  if (rawArgs.length === 0) {
    console.error('Usage: pnpm dev -- hm "<TargetName>"');
    process.exit(1);
  }

  const encounter = loadEncounter();
  if (!encounter) {
    console.error('No encounter in progress.');
    console.error('Try: encounter start; add actors; hm "<Target>".');
    process.exit(1);
  }

  const character = loadCharacter();
  if (!character) {
    console.error('No character loaded. Use `pnpm dev -- character load-name "<Name>"` first.');
    process.exit(1);
  }

  const caster = findPcActorByName(encounter, character.name);
  if (!caster) {
    console.error(`Loaded character ${character.name} is not part of the current encounter.`);
    console.error('Use `pnpm dev -- encounter add pc "<Name>"` to add them.');
    process.exit(1);
  }

  const targetIdentifier = rawArgs.join(' ').trim();
  if (!targetIdentifier) {
    console.error('Usage: pnpm dev -- hm "<TargetName>"');
    process.exit(1);
  }

  let target: EncounterActor;
  try {
    target = findActorByIdentifier(encounter, targetIdentifier);
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(`No actor matches "${targetIdentifier}".`);
    }
    console.error('Use `pnpm dev -- encounter list` to view participants.');
    process.exit(1);
    return;
  }

  let nextState: EncounterState;
  try {
    nextState = startHuntersMark(encounter, caster.id, target.id);
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error('Failed to apply Hunter\'s Mark.');
    }
    process.exit(1);
    return;
  }

  saveEncounter(nextState);
  const message = `Hunter's Mark applied: ${caster.name} → ${target.name} (concentration started).`;
  console.log(message);
  await logIfEnabled(message);
  process.exit(0);
}

function sortActorsForListing(state: EncounterState): EncounterActor[] {
  return Object.values(state.actors).sort((a, b) => {
    if (a.side !== b.side) {
      return a.side === 'party' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}

function sortedConditions(set: EncounterActor['conditions'] | undefined): Condition[] {
  if (!set) {
    return [];
  }
  return Object.keys(set).sort() as Condition[];
}

function formatConditionList(set: EncounterActor['conditions'] | undefined): string {
  const list = sortedConditions(set);
  return list.length > 0 ? list.join(', ') : '—';
}

function sortActorTags(tags: ActorTag[] | undefined): ActorTag[] {
  if (!tags) {
    return [];
  }
  return [...tags].sort((a, b) => {
    if (a.addedAtRound !== b.addedAtRound) {
      return a.addedAtRound - b.addedAtRound;
    }
    return a.id.localeCompare(b.id);
  });
}

function formatTagRange(tag: ActorTag): string | undefined {
  if (typeof tag.expiresAtRound === 'number') {
    return `R${tag.addedAtRound}→R${tag.expiresAtRound}`;
  }
  if (tag.duration) {
    const rounds = tag.duration.rounds ?? 0;
    const phase = tag.duration.at === 'turnStart' ? 'start' : 'end';
    const roundLabel = `${rounds} round${rounds === 1 ? '' : 's'}`;
    return `${roundLabel} (${phase})`;
  }
  return undefined;
}

function formatTagSummary(tag: ActorTag): string {
  const range = formatTagRange(tag);
  let label = range ? `${tag.text} (${range})` : tag.text;
  const extras: string[] = [];
  if (tag.note) {
    extras.push(`note: ${tag.note}`);
  }
  if (tag.source) {
    extras.push(`source: ${tag.source}`);
  }
  if (extras.length > 0) {
    label += ` — ${extras.join('; ')}`;
  }
  return label;
}

function formatTagDetail(tag: ActorTag): string {
  const range = formatTagRange(tag);
  const parts: string[] = [`${tag.id}: ${tag.text}`];
  if (range) {
    parts[0] = `${tag.id}: ${tag.text} (${range})`;
  }
  const extras: string[] = [];
  if (tag.note) {
    extras.push(`note: ${tag.note}`);
  }
  if (tag.source) {
    extras.push(`source: ${tag.source}`);
  }
  if (extras.length > 0) {
    parts.push(`(${extras.join('; ')})`);
  }
  return parts.join(' ');
}

function formatActorTags(tags: ActorTag[] | undefined): string {
  const sorted = sortActorTags(tags);
  if (sorted.length === 0) {
    return '—';
  }
  return sorted.map((tag) => formatTagSummary(tag)).join(', ');
}

function collectActorTags(state: EncounterState): Record<string, ActorTag[]> {
  const result: Record<string, ActorTag[]> = {};
  Object.entries(state.actors).forEach(([actorId, actor]) => {
    if (actor.tags && actor.tags.length > 0) {
      result[actorId] = actor.tags.map((tag) => ({
        ...tag,
        duration: tag.duration ? { ...tag.duration } : undefined,
      }));
    }
  });
  return result;
}

function diffExpiredTags(
  before: Record<string, ActorTag[]>,
  after: EncounterState,
): { actorId: string; tag: ActorTag }[] {
  const expired: { actorId: string; tag: ActorTag }[] = [];
  Object.entries(before).forEach(([actorId, tags]) => {
    const remainingIds = new Set((after.actors[actorId]?.tags ?? []).map((tag) => tag.id));
    tags.forEach((tag) => {
      if (remainingIds.has(tag.id)) {
        return;
      }
      if (tag.duration || typeof tag.expiresAtRound === 'number') {
        if (typeof tag.expiresAtRound === 'number' && after.round <= tag.expiresAtRound) {
          return;
        }
        expired.push({ actorId, tag });
      }
    });
  });
  return expired;
}

function describeConditionEffects(
  attacker: EncounterActor,
  defender: EncounterActor,
  mode: 'melee' | 'ranged',
): string[] {
  const effects: string[] = [];

  if (hasCondition(defender.conditions, 'prone')) {
    if (mode === 'melee') {
      effects.push('advantage from defender prone');
    } else {
      effects.push('disadvantage from defender prone');
    }
  }

  if (hasCondition(defender.conditions, 'restrained')) {
    effects.push('advantage from defender restrained');
  }

  if (hasCondition(attacker.conditions, 'restrained')) {
    effects.push('disadvantage from attacker restrained');
  }

  if (hasCondition(attacker.conditions, 'poisoned')) {
    effects.push('disadvantage from attacker poisoned');
  }

  return effects;
}

function applyEncounterDamage(state: EncounterState, actorId: string, amount: number): EncounterState {
  if (!Number.isFinite(amount) || amount <= 0) {
    return state;
  }
  const actor = state.actors[actorId];
  if (!actor) {
    return state;
  }
  const updated: EncounterActor = cloneEncounterActor(actor);
  applyDamage(updated, amount);
  const nextHp = getCurrentHp(updated);
  const actors = { ...state.actors, [actorId]: updated };
  const defeated = new Set(state.defeated);
  if (nextHp === 0) {
    defeated.add(actorId);
  } else {
    defeated.delete(actorId);
  }
  return { ...state, actors, defeated };
}

function applyEncounterHealing(state: EncounterState, actorId: string, amount: number): EncounterState {
  if (!Number.isFinite(amount) || amount <= 0) {
    return state;
  }
  const actor = state.actors[actorId];
  if (!actor) {
    return state;
  }
  const updated: EncounterActor = cloneEncounterActor(actor);
  applyHealing(updated, amount);
  const actors = { ...state.actors, [actorId]: updated };
  const defeated = new Set(state.defeated);
  if (getCurrentHp(updated) > 0) {
    defeated.delete(actorId);
  }
  return { ...state, actors, defeated };
}

async function handleEncounterDamageCommand(rawArgs: string[]): Promise<void> {
  if (rawArgs.length < 2) {
    console.error('Usage: pnpm dev -- encounter damage "<Name|id>" <amount>');
    process.exit(1);
  }

  const [identifier, amountRaw] = rawArgs;
  const amount = Number.parseInt(amountRaw ?? '', 10);
  if (!Number.isFinite(amount) || amount <= 0) {
    console.error('Damage amount must be a positive integer.');
    process.exit(1);
  }

  const encounter = requireEncounterState();
  let actor: EncounterActor;
  try {
    actor = findActorByIdentifier(encounter, identifier);
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
    return;
  }

  const nextEncounter = applyEncounterDamage(encounter, actor.id, amount);
  const updatedActor = nextEncounter.actors[actor.id];
  if (!updatedActor) {
    console.error('Failed to update actor after applying damage.');
    process.exit(1);
    return;
  }

  saveEncounter(nextEncounter);
  const hpLabel = formatHitPoints(updatedActor);
  console.log(`${updatedActor.name} takes ${amount} damage (HP ${hpLabel}).`);
  await logIfEnabled(`${updatedActor.name} took ${amount} damage (HP ${hpLabel}).`);
  process.exit(0);
}

async function handleEncounterHealCommand(rawArgs: string[]): Promise<void> {
  if (rawArgs.length < 2) {
    console.error('Usage: pnpm dev -- encounter heal "<Name|id>" <amount>');
    process.exit(1);
  }

  const [identifier, amountRaw] = rawArgs;
  const amount = Number.parseInt(amountRaw ?? '', 10);
  if (!Number.isFinite(amount) || amount <= 0) {
    console.error('Healing amount must be a positive integer.');
    process.exit(1);
  }

  const encounter = requireEncounterState();
  let actor: EncounterActor;
  try {
    actor = findActorByIdentifier(encounter, identifier);
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
    return;
  }

  const nextEncounter = applyEncounterHealing(encounter, actor.id, amount);
  const updatedActor = nextEncounter.actors[actor.id];
  if (!updatedActor) {
    console.error('Failed to update actor after applying healing.');
    process.exit(1);
    return;
  }

  saveEncounter(nextEncounter);
  const hpLabel = formatHitPoints(updatedActor);
  console.log(`${updatedActor.name} heals ${amount} HP (HP ${hpLabel}).`);
  await logIfEnabled(`${updatedActor.name} healed ${amount} HP (HP ${hpLabel}).`);
  process.exit(0);
}

async function handleDeathCommand(rawArgs: string[]): Promise<void> {
  if (rawArgs.length === 0) {
    console.error('Usage: pnpm dev -- death save "<Name|id>"');
    process.exit(1);
  }

  const [subcommand, ...rest] = rawArgs;
  if (!subcommand || subcommand.toLowerCase() !== 'save') {
    console.error('Usage: pnpm dev -- death save "<Name|id>"');
    process.exit(1);
  }

  const identifier = rest.join(' ').trim();
  if (!identifier) {
    console.error('Target name or id is required for death save.');
    process.exit(1);
  }

  const encounter = requireEncounterState();
  let actor: EncounterActor;
  try {
    actor = findActorByIdentifier(encounter, identifier);
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
    return;
  }

  const updatedActor = cloneEncounterActor(actor);
  const roll = Math.floor(Math.random() * 20) + 1;
  const result = rollDeathSave(updatedActor, roll);

  const actors = { ...encounter.actors, [actor.id]: updatedActor };
  const defeated = new Set(encounter.defeated);
  const currentHp = getCurrentHp(updatedActor);
  if (currentHp > 0) {
    defeated.delete(actor.id);
  } else {
    defeated.add(actor.id);
  }

  const nextEncounter: EncounterState = { ...encounter, actors, defeated };
  saveEncounter(nextEncounter);

  const message = `${result.line} (roll=${roll})`;
  console.log(message);
  await logIfEnabled(message);
  process.exit(0);
}

async function handleStabilizeCommand(rawArgs: string[]): Promise<void> {
  if (rawArgs.length === 0) {
    console.error('Usage: pnpm dev -- stabilize "<Name|id>"');
    process.exit(1);
  }

  const identifier = rawArgs.join(' ').trim();
  if (!identifier) {
    console.error('Target name or id is required to stabilize.');
    process.exit(1);
  }

  const encounter = requireEncounterState();
  let actor: EncounterActor;
  try {
    actor = findActorByIdentifier(encounter, identifier);
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
    return;
  }

  const updatedActor = cloneEncounterActor(actor);
  const currentHp = getCurrentHp(updatedActor);
  if (currentHp > 0) {
    applyDamage(updatedActor, currentHp);
  }

  const death = getDeath(updatedActor);
  death.successes = 3;
  death.failures = 0;
  death.dead = false;
  death.stable = true;

  const actors = { ...encounter.actors, [actor.id]: updatedActor };
  const defeated = new Set(encounter.defeated);
  defeated.add(actor.id);

  const nextEncounter: EncounterState = { ...encounter, actors, defeated };
  saveEncounter(nextEncounter);

  const message = `${updatedActor.name} is stabilized at 0 HP.`;
  console.log(message);
  await logIfEnabled(message);
  process.exit(0);
}

function formatActorLine(state: EncounterState, actor: EncounterActor, currentId: string | undefined): string {
  const pointer = currentId === actor.id ? '→' : ' ';
  const defeated = state.defeated.has(actor.id) ? ' [DEFEATED]' : '';
  const initiative = state.order.find((entry) => entry.actorId === actor.id);
  const initLabel = initiative ? ` init=${initiative.total} (roll ${initiative.rolled})` : '';
  const concentrationEntry = state.concentration?.[actor.id];
  const concentrationLabel = concentrationEntry ? ` [conc: ${concentrationEntry.spellName}]` : '';
  let line = `${pointer} [${actor.side}] ${actor.name} (id=${actor.id}) AC ${actor.ac} HP ${formatHitPoints(actor)}${defeated}${concentrationLabel}`;
  line += ` — conditions: ${formatConditionList(actor.conditions)}`;
  line += ` — tags: ${formatActorTags(actor.tags)}`;
  line += initLabel;
  return line;
}

function buildPlayerActor(state: EncounterState, name: string, character: Character): PlayerActor {
  const normalized = normalizeCharacter(character);
  const mods = abilityMods(normalized.abilities);
  const pb =
    typeof normalized.proficiencyBonus === 'number' && Number.isFinite(normalized.proficiencyBonus)
      ? normalized.proficiencyBonus
      : proficiencyBonusForLevel(normalized.level);
  const id = generateActorId(state, name);
  const ac = typeof normalized.ac === 'number' ? normalized.ac : derivedAC(normalized);
  const maxHp = normalized.hp?.max ?? derivedMaxHP(normalized);
  const currentHp = normalized.hp?.current ?? maxHp;
  const { profile: defaultWeapon } = resolveDefaultWeaponInfo(normalized, mods, pb);

  return {
    id,
    name,
    side: 'party',
    type: 'pc',
    ac,
    hp: currentHp,
    maxHp,
    abilityMods: mods,
    proficiencyBonus: pb,
    defaultWeapon,
  };
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

function handleCharacterSlotsCommand(rawArgs: string[]): void {
  if (rawArgs.length === 0) {
    console.error('Usage: pnpm dev -- character slots <show|set> [...].');
    process.exit(1);
  }

  const [action, ...rest] = rawArgs;
  const character = requireLoadedCharacter();

  if (action === 'show') {
    const slots = ensureSlots(character);
    printSlotTable(slots);
    process.exit(0);
  }

  if (action === 'set') {
    const spec = rest.join(' ').trim();
    if (!spec) {
      console.error('Usage: pnpm dev -- character slots set "1=4,2=2"');
      process.exit(1);
    }
    let updates: Partial<Record<number, number>>;
    try {
      updates = parseSlotSpec(spec);
    } catch (error) {
      if (error instanceof Error) {
        console.error(error.message);
      } else {
        console.error('Failed to parse slot specification.');
      }
      process.exit(1);
    }
    setSlots(character, updates);
    saveCharacter(character);
    const slots = ensureSlots(character);
    printSlotTable(slots);
    process.exit(0);
  }

  console.error(`Unknown character slots action: ${action}`);
  process.exit(1);
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

    const acRaw = (data as { ac?: unknown }).ac;
    if (acRaw !== undefined) {
      const acValue = Number(acRaw);
      if (!Number.isFinite(acValue)) {
        throw new Error('Character ac must be a finite number when provided.');
      }
      character.ac = acValue;
    }

    const pbRaw = (data as { proficiencyBonus?: unknown }).proficiencyBonus;
    if (pbRaw !== undefined) {
      const pbValue = Number(pbRaw);
      if (!Number.isFinite(pbValue)) {
        throw new Error('Character proficiencyBonus must be a finite number when provided.');
      }
      character.proficiencyBonus = pbValue;
    }

    const hpRaw = (data as { hp?: unknown }).hp;
    if (hpRaw !== undefined) {
      if (hpRaw === null || typeof hpRaw !== 'object' || Array.isArray(hpRaw)) {
        throw new Error('Character hp must be an object when provided.');
      }
      const record = hpRaw as Record<string, unknown>;
      const hp: NonNullable<Character['hp']> = {};

      if (record.max !== undefined) {
        const value = Number(record.max);
        if (!Number.isFinite(value)) {
          throw new Error('Character hp.max must be a finite number when provided.');
        }
        hp.max = value;
      }

      if (record.current !== undefined) {
        const value = Number(record.current);
        if (!Number.isFinite(value)) {
          throw new Error('Character hp.current must be a finite number when provided.');
        }
        hp.current = value;
      }

      if (record.temp !== undefined) {
        const value = Number(record.temp);
        if (!Number.isFinite(value)) {
          throw new Error('Character hp.temp must be a finite number when provided.');
        }
        hp.temp = value;
      }

      character.hp = hp;
    }

    const sensesRaw = (data as { senses?: unknown }).senses;
    if (sensesRaw !== undefined) {
      if (sensesRaw === null || typeof sensesRaw !== 'object' || Array.isArray(sensesRaw)) {
        throw new Error('Character senses must be an object when provided.');
      }
      character.senses = { ...(sensesRaw as Record<string, unknown>) };
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

    const normalized = normalizeCharacter(character);
    saveCharacter(normalized);
    const pb =
      typeof normalized.proficiencyBonus === 'number' && Number.isFinite(normalized.proficiencyBonus)
        ? normalized.proficiencyBonus
        : proficiencyBonusForLevel(normalized.level);
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

async function handleCharacterCastCommand(rawArgs: string[]): Promise<void> {
  if (rawArgs.length === 0) {
    console.error('Missing spell name for character cast.');
    process.exit(1);
  }

  const [spellNameRaw, ...rest] = rawArgs;
  const spellName = spellNameRaw.trim();
  if (!spellName) {
    console.error('Spell name cannot be empty.');
    process.exit(1);
  }

  const character = requireLoadedCharacter();

  let abilityOverride: 'INT' | 'WIS' | 'CHA' | undefined;
  let targetIdentifier: string | undefined;
  let seed: string | undefined;
  let attackModeOverride: 'melee' | 'ranged' | undefined;
  let slotLevel: number | undefined;

  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    const lower = arg.toLowerCase();

    if (lower === '--ability') {
      if (i + 1 >= rest.length) {
        console.error('Expected value after --ability.');
        process.exit(1);
      }
      const value = rest[i + 1].toUpperCase();
      if (value !== 'INT' && value !== 'WIS' && value !== 'CHA') {
        console.error('Casting ability must be INT, WIS, or CHA.');
        process.exit(1);
      }
      abilityOverride = value as 'INT' | 'WIS' | 'CHA';
      i += 1;
      continue;
    }

    if (arg.startsWith('--ability=')) {
      const value = arg.slice('--ability='.length).toUpperCase();
      if (value !== 'INT' && value !== 'WIS' && value !== 'CHA') {
        console.error('Casting ability must be INT, WIS, or CHA.');
        process.exit(1);
      }
      abilityOverride = value as 'INT' | 'WIS' | 'CHA';
      continue;
    }

    if (lower === '--target') {
      if (i + 1 >= rest.length) {
        console.error('Expected value after --target.');
        process.exit(1);
      }
      targetIdentifier = rest[i + 1];
      i += 1;
      continue;
    }

    if (arg.startsWith('--target=')) {
      targetIdentifier = arg.slice('--target='.length);
      continue;
    }

    if (lower === '--slotlevel' || lower === '--slot-level') {
      if (i + 1 >= rest.length) {
        console.error('Expected value after --slotLevel.');
        process.exit(1);
      }
      const value = Number.parseInt(rest[i + 1], 10);
      if (!Number.isFinite(value) || value < 1 || value > 9) {
        console.error('--slotLevel must be an integer between 1 and 9.');
        process.exit(1);
      }
      slotLevel = value;
      i += 1;
      continue;
    }

    if (lower.startsWith('--slotlevel=')) {
      const rawValue = arg.slice(arg.indexOf('=') + 1);
      const value = Number.parseInt(rawValue, 10);
      if (!Number.isFinite(value) || value < 1 || value > 9) {
        console.error('--slotLevel must be an integer between 1 and 9.');
        process.exit(1);
      }
      slotLevel = value;
      continue;
    }

    if (lower.startsWith('--slot-level=')) {
      const rawValue = arg.slice(arg.indexOf('=') + 1);
      const value = Number.parseInt(rawValue, 10);
      if (!Number.isFinite(value) || value < 1 || value > 9) {
        console.error('--slotLevel must be an integer between 1 and 9.');
        process.exit(1);
      }
      slotLevel = value;
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

    if (arg.startsWith('--seed=')) {
      seed = arg.slice('--seed='.length);
      continue;
    }

    if (lower === '--melee') {
      if (attackModeOverride && attackModeOverride !== 'melee') {
        console.error('Cannot specify both --melee and --ranged.');
        process.exit(1);
      }
      attackModeOverride = 'melee';
      continue;
    }

    if (lower === '--ranged') {
      if (attackModeOverride && attackModeOverride !== 'ranged') {
        console.error('Cannot specify both --melee and --ranged.');
        process.exit(1);
      }
      attackModeOverride = 'ranged';
      continue;
    }

    console.warn(`Ignoring unknown argument: ${arg}`);
  }

  const baseSpell = await fetchSpell(spellName);
  const resolvedSpell: NormalizedSpell =
    attackModeOverride && baseSpell.attackType !== attackModeOverride
      ? { ...baseSpell, attackType: attackModeOverride }
      : baseSpell;

  const castingAbility = chooseCastingAbility(character, resolvedSpell, abilityOverride);
  const casterMods = abilityMods(character.abilities);
  const proficiencyBonus = proficiencyBonusForLevel(character.level);
  const typeLabel = resolvedSpell.damageType ? ` ${resolvedSpell.damageType.toLowerCase()}` : '';

  let encounter: EncounterState | undefined;
  let target: EncounterActor | undefined;

  if (resolvedSpell.attackType || targetIdentifier) {
    encounter = requireEncounterState();
  }

  if (targetIdentifier) {
    try {
      target = findActorByIdentifier(encounter as EncounterState, targetIdentifier);
    } catch (error) {
      if (error instanceof Error) {
        console.error(error.message);
      }
      process.exit(1);
    }
    if (target && encounter && (encounter.defeated.has(target.id) || target.hp <= 0)) {
      console.error(`${target.name} (id=${target.id}) is defeated. Choose an active target.`);
      process.exit(1);
    }
  } else if (resolvedSpell.attackType) {
    console.error('Spell attacks require a --target in the active encounter.');
    process.exit(1);
  }

  let slotTracking: { level: number; before: number } | undefined;
  if (resolvedSpell.level >= 1) {
    const effectiveSlotLevel = Math.max(resolvedSpell.level, slotLevel ?? resolvedSpell.level);
    if (effectiveSlotLevel > 9) {
      console.error('Slot level must be between 1 and 9.');
      process.exit(1);
    }
    if (!canSpendSlot(character, effectiveSlotLevel)) {
      console.error(`No slot available at level ${effectiveSlotLevel}.`);
      process.exit(1);
    }
    const slots = ensureSlots(character);
    slotTracking = { level: effectiveSlotLevel, before: slots.remaining[effectiveSlotLevel] ?? 0 };
  }

  const castResult = castSpell({
    caster: character,
    spell: resolvedSpell,
    castingAbility,
    targetAC: target?.ac,
    slotLevel,
    seed,
  });

  const notes = castResult.notes ?? [];

  let slotInfo: { level: number; remaining: number; max: number } | undefined;
  if (slotTracking) {
    const slots = ensureSlots(character);
    const after = slots.remaining[slotTracking.level] ?? 0;
    if (after !== slotTracking.before) {
      slotInfo = {
        level: slotTracking.level,
        remaining: after,
        max: slots.max[slotTracking.level] ?? 0,
      };
      saveCharacter(character);
    }
  }

  const logSlotSpend = () => {
    if (slotInfo) {
      console.log(`(slot ${slotInfo.level} spent: remaining ${slotInfo.remaining}/${slotInfo.max})`);
    }
  };

  if (castResult.kind === 'attack' && resolvedSpell.attackType) {
    if (!encounter || !target) {
      console.error('Target required for spell attack.');
      process.exit(1);
    }

    const attack = castResult.attack;
    if (!attack) {
      console.error('Failed to resolve spell attack.');
      process.exit(1);
    }

    const toHitMod = (casterMods[castingAbility] ?? 0) + proficiencyBonus;
    console.log(
      `Casting ${resolvedSpell.name} (${castingAbility} spell attack ${formatModifier(toHitMod)} vs AC ${target.ac}) on ${target.name}...`,
    );
    const outcome = attack.isCrit ? 'CRIT!' : attack.isFumble ? 'FUMBLE' : attack.hit ? 'HIT' : 'MISS';
    console.log(`Attack: ${attack.expression}`);
    const rollsLine = `Rolls: [${attack.rolls.join(', ')}] → natural ${attack.natural} → total ${attack.total}`;
    console.log(outcome ? `${rollsLine} → ${outcome}` : rollsLine);

    if (castResult.damage) {
      console.log(`Damage: ${castResult.damage.expression} → ${castResult.damage.final}${typeLabel}`);
    } else {
      console.log('Damage: —');
    }

    let nextEncounter = encounter;
    let reminderLines: string[] = [];
    if (castResult.damage && (attack.hit || attack.isCrit)) {
      const appliedDamage = castResult.damage.final;
      nextEncounter = applyEncounterDamage(nextEncounter, target.id, appliedDamage);
      reminderLines = concentrationReminderLinesForDamage(nextEncounter, target.id, appliedDamage);
    }
    if (resolvedSpell.concentration) {
      const concentrationResult = maybeStartPcConcentration(nextEncounter, character, resolvedSpell, target);
      if (concentrationResult) {
        nextEncounter = concentrationResult.state;
        const targetLabel = concentrationTargetSummary(concentrationResult.state, concentrationResult.entry);
        console.log(
          `Concentration started on ${concentrationResult.entry.spellName} (caster: ${concentrationResult.caster.name}, target: ${targetLabel}).`,
        );
      }
    }
    saveEncounter(nextEncounter);

    const updated = nextEncounter.actors[target.id] ?? target;
    const status = nextEncounter.defeated.has(target.id) ? 'DEFEATED' : 'active';
    console.log(`Target ${updated.name} now has ${formatHitPoints(updated)} HP (${status}).`);
    reminderLines.forEach((line) => console.log(line));

    logSlotSpend();
    notes.forEach((note) => console.log(`Note: ${note}`));
    process.exit(0);
  }

  if (castResult.kind === 'save' && resolvedSpell.save) {
    const dc = castResult.save?.dc ?? 0;
    if (target) {
      console.log(`Casting ${resolvedSpell.name} (${castingAbility} DC ${dc}) on ${target.name}...`);
      const targetMod = target.abilityMods?.[resolvedSpell.save.ability] ?? 0;
      const saveSeed = seed ? `${seed}:save` : undefined;
      const saveResult = savingThrow({
        ability: resolvedSpell.save.ability,
        modifier: targetMod,
        proficient: false,
        dc,
        seed: saveSeed,
      });
      const rollDisplay =
        saveResult.rolls.length === 1 ? `${saveResult.rolls[0]}` : `[${saveResult.rolls.join(', ')}]`;
      const modDisplay = targetMod !== 0 ? ` ${formatModifier(targetMod)}` : '';
      const outcome = saveResult.success ? 'SUCCESS' : 'FAIL';
      console.log(`Target ${resolvedSpell.save.ability} save: rolled ${rollDisplay}${modDisplay} = ${saveResult.total} → ${outcome}`);

      let finalDamage = castResult.damage?.final ?? 0;
      if (castResult.damage) {
        if (saveResult.success) {
          if (resolvedSpell.save.onSuccess === 'half') {
            const halved = Math.floor(finalDamage / 2);
            console.log(`Damage: ${castResult.damage.expression} → ${castResult.damage.final}${typeLabel} (halved to ${halved})`);
            finalDamage = halved;
          } else {
            console.log(`Damage: ${castResult.damage.expression} → ${castResult.damage.final}${typeLabel} (negated)`);
            finalDamage = 0;
          }
        } else {
          console.log(`Damage: ${castResult.damage.expression} → ${castResult.damage.final}${typeLabel}`);
        }
      } else {
        console.log('Damage: —');
      }

      let nextEncounter = encounter ?? requireEncounterState();
      let reminderLines: string[] = [];
      if (finalDamage > 0) {
        nextEncounter = applyEncounterDamage(nextEncounter, target.id, finalDamage);
        reminderLines = concentrationReminderLinesForDamage(nextEncounter, target.id, finalDamage);
      }
      if (resolvedSpell.concentration) {
        const concentrationResult = maybeStartPcConcentration(nextEncounter, character, resolvedSpell, target);
        if (concentrationResult) {
          nextEncounter = concentrationResult.state;
          const targetLabel = concentrationTargetSummary(concentrationResult.state, concentrationResult.entry);
          console.log(
            `Concentration started on ${concentrationResult.entry.spellName} (caster: ${concentrationResult.caster.name}, target: ${targetLabel}).`,
          );
        }
      }
      saveEncounter(nextEncounter);
      const updated = nextEncounter.actors[target.id] ?? target;
      const status = nextEncounter.defeated.has(updated.id) ? 'DEFEATED' : 'active';
      console.log(`Target ${updated.name} now has ${formatHitPoints(updated)} HP (${status}).`);
      reminderLines.forEach((line) => console.log(line));

      logSlotSpend();
      notes.forEach((note) => console.log(`Note: ${note}`));
      process.exit(0);
    }

    console.log(`Casting ${resolvedSpell.name} (${castingAbility} DC ${dc})...`);
    if (castResult.damage) {
      console.log(`Damage: ${castResult.damage.expression} → ${castResult.damage.final}${typeLabel}`);
    } else {
      console.log('Damage: —');
    }
    logSlotSpend();
    notes.forEach((note) => console.log(`Note: ${note}`));
    process.exit(0);
  }

  console.log(`Casting ${resolvedSpell.name}...`);
  if (resolvedSpell.concentration) {
    const activeEncounter = encounter ?? loadEncounter();
    if (activeEncounter) {
      const concentrationResult = maybeStartPcConcentration(activeEncounter, character, resolvedSpell, target);
      if (concentrationResult) {
        saveEncounter(concentrationResult.state);
        const targetLabel = concentrationTargetSummary(concentrationResult.state, concentrationResult.entry);
        console.log(
          `Concentration started on ${concentrationResult.entry.spellName} (caster: ${concentrationResult.caster.name}, target: ${targetLabel}).`,
        );
      }
    }
  }
  logSlotSpend();
  if (notes.length > 0) {
    notes.forEach((note) => console.log(`Note: ${note}`));
  } else {
    console.log('No attack or save mechanics available for this spell.');
  }
  process.exit(0);
}

function handleCharacterRestCommand(rawArgs: string[]): void {
  if (rawArgs.length === 0) {
    console.error('Usage: pnpm dev -- character rest <long|short>.');
    process.exit(1);
  }

  const [restType] = rawArgs;

  if (restType === 'long') {
    const character = requireLoadedCharacter();
    restoreAllSlots(character);
    saveCharacter(character);

    const encounter = loadEncounter();
    if (encounter) {
      const cleared = clearAllConcentration(encounter);
      if (cleared !== encounter) {
        saveEncounter(cleared);
      }
    }

    console.log('Long rest complete: slots restored; concentration cleared.');
    process.exit(0);
  }

  if (restType === 'short') {
    requireLoadedCharacter();
    console.log('Short rest: no slot recovery by default.');
    process.exit(0);
  }

  console.error(`Unknown rest type: ${restType}`);
  process.exit(1);
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

async function handleCharacterCommand(rawArgs: string[]): Promise<void> {
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

  if (subcommand === 'slots') {
    handleCharacterSlotsCommand(rest);
    return;
  }

  if (subcommand === 'rest') {
    handleCharacterRestCommand(rest);
    return;
  }

  if (subcommand === 'cast') {
    await handleCharacterCastCommand(rest);
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

async function handleEncounterStartCommand(rawArgs: string[]): Promise<void> {
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
  const line = `Encounter started${seedLabel}.`;
  console.log(line);
  await logIfEnabled(line);
  process.exit(0);
}

async function handleEncounterAddPcCommand(name: string): Promise<void> {
  const encounter = requireEncounterState();
  const character = requireLoadedCharacter();
  const actor = buildPlayerActor(encounter, name, character);
  const nextState = addEncounterActor(encounter, actor);
  saveEncounter(nextState);
  const line = `Added ${actor.name} (${actor.side}).`;
  console.log(`Added PC ${actor.name} (id=${actor.id}).`);
  await logIfEnabled(line);
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
  const sideLabel = added[0]?.side ?? 'foe';
  console.log(`Added ${added.length} ${template.name}${added.length === 1 ? '' : 's'} on side '${sideLabel}': ${names}`);
  for (const actor of added) {
    await logIfEnabled(`Added ${actor.name} (${actor.side}).`);
  }
  process.exit(0);
}

function parseSideOption(value: string | undefined): Side {
  if (value === undefined) {
    throw new Error('Expected value after --side.');
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === 'party' || normalized === 'foe' || normalized === 'neutral') {
    return normalized;
  }
  throw new Error('Invalid side. Expected one of: party, foe, neutral.');
}

async function handleEncounterBuildCommand(rawArgs: string[]): Promise<void> {
  if (rawArgs.length === 0) {
    console.error('Usage: pnpm dev -- encounter build "<Spec>" [--side <party|foe|neutral>]');
    process.exit(1);
  }

  const specParts: string[] = [];
  let side: Side = 'foe';

  for (let i = 0; i < rawArgs.length; i += 1) {
    const arg = rawArgs[i];
    if (!arg) {
      continue;
    }

    if (arg.startsWith('--side=')) {
      side = parseSideOption(arg.slice('--side='.length));
      continue;
    }

    if (arg === '--side') {
      side = parseSideOption(rawArgs[i + 1]);
      i += 1;
      continue;
    }

    specParts.push(arg);
  }

  const spec = specParts.join(' ').trim();
  if (!spec) {
    console.error('Encounter build spec is required.');
    process.exit(1);
  }

  const encounter = requireEncounterState();
  const index = await readCompendiumIndex();
  const { state, added, missing } = await buildEncounterFromSpec(encounter, spec, side, { index });

  if (missing.length > 0) {
    for (const name of missing) {
      console.warn(`Unknown monster: ${name}`);
    }
  }

  if (added.length === 0) {
    console.log('No monsters added.');
    process.exit(0);
  }

  saveEncounter(state);
  console.log(`Built encounter: ${spec}`);
  for (const actor of added) {
    await logIfEnabled(`Added ${actor.name} (${actor.side}).`);
  }
  process.exit(0);
}

async function handleEncounterAddSampleMonsterCommand(type: string, rawArgs: string[]): Promise<void> {
  const key = type.toLowerCase() as keyof typeof SAMPLE_MONSTER_TYPES;
  const templateName = SAMPLE_MONSTER_TYPES[key];
  if (!templateName) {
    console.error(`Unknown encounter add type: ${type}`);
    process.exit(1);
  }

  let count = 1;
  let baseNameOverride: string | undefined;
  let side: Side = 'foe';

  try {
    for (let i = 0; i < rawArgs.length; i += 1) {
      const arg = rawArgs[i];
      if (!arg) {
        continue;
      }

      if (arg.startsWith('--n=')) {
        count = parsePositiveInteger(arg.slice('--n='.length), '--n');
        continue;
      }

      const lower = arg.toLowerCase();

      if (lower === '--n') {
        count = parsePositiveInteger(rawArgs[i + 1], '--n');
        i += 1;
        continue;
      }

      if (lower.startsWith('--name=')) {
        baseNameOverride = arg.slice('--name='.length);
        continue;
      }

      if (lower === '--name') {
        baseNameOverride = rawArgs[i + 1];
        if (baseNameOverride === undefined) {
          throw new Error('Expected value after --name.');
        }
        i += 1;
        continue;
      }

      if (lower.startsWith('--side=')) {
        side = parseSideOption(arg.slice('--side='.length));
        continue;
      }

      if (lower === '--side') {
        side = parseSideOption(rawArgs[i + 1]);
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

  const template = getMonsterByName(templateName);
  if (!template) {
    console.error(`Monster template not found: ${templateName}`);
    process.exit(1);
  }

  const encounter = requireEncounterState();
  const baseName = baseNameOverride?.trim() ? baseNameOverride.trim() : template.name;
  const { state, added } = addMonsters(encounter, template, baseName, count, side);
  saveEncounter(state);

  const summaryName = added.length === 1 ? baseName : `${baseName}s`;
  const names = added.map((actor) => `${actor.name} (id=${actor.id})`).join(', ');
  console.log(`Added ${added.length} ${summaryName} on side '${side}': ${names}`);
  for (const actor of added) {
    await logIfEnabled(`Added ${actor.name} (${actor.side}).`);
  }
  process.exit(0);
}

async function handleEncounterAddCommand(rawArgs: string[]): Promise<void> {
  if (rawArgs.length === 0) {
    console.error('Usage: pnpm dev -- encounter add <pc|monster|goblin|bandit|skeleton> [...]');
    process.exit(1);
  }

  const [type, ...rest] = rawArgs;
  if (type === 'pc') {
    const name = rest[0];
    if (!name) {
      console.error('Missing PC name.');
      process.exit(1);
    }
    await handleEncounterAddPcCommand(name);
    return;
  }

  if (type === 'monster') {
    if (rest.length === 0) {
      console.error('Missing monster name.');
      process.exit(1);
    }
    await handleEncounterAddMonsterCommand(rest);
    return;
  }

  const sampleKey = type.toLowerCase();
  if (sampleKey in SAMPLE_MONSTER_TYPES) {
    await handleEncounterAddSampleMonsterCommand(sampleKey, rest);
    return;
  }

  console.error(`Unknown encounter add type: ${type}`);
  process.exit(1);
}

function handleEncounterConcentrationStartCommand(rawArgs: string[]): void {
  if (rawArgs.length < 2) {
    console.error(
      'Usage: pnpm dev -- encounter concentration start "<casterIdOrName>" "<Spell Name>" [--target "<id|name>"]',
    );
    process.exit(1);
  }

  const [casterIdentifierRaw, spellNameRaw, ...rest] = rawArgs;
  const spellName = spellNameRaw.trim();
  if (!spellName) {
    console.error('Spell name cannot be empty.');
    process.exit(1);
  }

  let targetIdentifier: string | undefined;
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    const lower = arg.toLowerCase();
    if (lower === '--target') {
      if (i + 1 >= rest.length) {
        console.error('Expected value after --target.');
        process.exit(1);
      }
      targetIdentifier = rest[i + 1];
      i += 1;
      continue;
    }
    if (lower.startsWith('--target=')) {
      targetIdentifier = arg.slice(arg.indexOf('=') + 1);
      continue;
    }
    console.warn(`Ignoring unknown argument: ${arg}`);
  }

  const encounter = requireEncounterState();
  let caster: EncounterActor;
  try {
    caster = findActorByIdentifier(encounter, casterIdentifierRaw);
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
    return;
  }

  let target: EncounterActor | undefined;
  if (targetIdentifier) {
    try {
      target = findActorByIdentifier(encounter, targetIdentifier);
    } catch (error) {
      if (error instanceof Error) {
        console.error(error.message);
      }
      process.exit(1);
      return;
    }
  }

  const entry = {
    casterId: caster.id,
    spellName,
    targetId: target?.id,
  };

  const nextState = startConcentration(encounter, entry);
  saveEncounter(nextState);
  const targetLabel = concentrationTargetSummary(nextState, entry);
  console.log(`Concentration started on ${spellName} (caster: ${caster.name}, target: ${targetLabel}).`);
  process.exit(0);
}

function handleEncounterConcentrationEndCommand(rawArgs: string[]): void {
  if (rawArgs.length === 0) {
    console.error('Usage: pnpm dev -- encounter concentration end "<casterIdOrName>"');
    process.exit(1);
  }

  const [casterIdentifierRaw] = rawArgs;
  const encounter = requireEncounterState();
  let caster: EncounterActor;

  try {
    caster = findActorByIdentifier(encounter, casterIdentifierRaw);
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
    return;
  }

  const existing = getConcentration(encounter, caster.id);
  if (!existing) {
    console.log(`${caster.name} has no active concentration.`);
    process.exit(0);
  }

  const nextState = endConcentration(encounter, caster.id);
  saveEncounter(nextState);
  console.log(`Concentration on ${existing.spellName} ended for ${caster.name}.`);
  process.exit(0);
}

function handleEncounterConcentrationCheckCommand(rawArgs: string[]): void {
  if (rawArgs.length < 2) {
    console.error('Usage: pnpm dev -- encounter concentration check "<casterIdOrName>" <damage> [--seed <value>]');
    process.exit(1);
  }

  const [casterIdentifierRaw, damageRaw, ...rest] = rawArgs;
  let seed: string | undefined;

  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    const lower = arg.toLowerCase();
    if (lower === '--seed') {
      if (i + 1 >= rest.length) {
        console.error('Expected value after --seed.');
        process.exit(1);
      }
      seed = rest[i + 1];
      i += 1;
      continue;
    }
    if (lower.startsWith('--seed=')) {
      seed = arg.slice(arg.indexOf('=') + 1);
      continue;
    }
    console.warn(`Ignoring unknown argument: ${arg}`);
  }

  const damage = Number.parseFloat(damageRaw);
  if (!Number.isFinite(damage) || damage < 0) {
    console.error('Damage must be a non-negative number.');
    process.exit(1);
  }

  const encounter = requireEncounterState();
  let caster: EncounterActor;
  try {
    caster = findActorByIdentifier(encounter, casterIdentifierRaw);
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
    return;
  }

  const entry = getConcentration(encounter, caster.id);
  if (!entry) {
    console.error(`${caster.name} has no active concentration.`);
    process.exit(1);
  }

  const dc = concentrationDCFromDamage(damage);
  console.log(
    `Concentration check for ${caster.name} (spell: ${entry.spellName}) — damage ${damage} → DC ${dc}.`,
  );

  const reminderLines = remindersFor(encounter, caster.id, null, 'save');
  for (const line of reminderLines) {
    console.log(line);
  }

  let success = false;
  let total = 0;
  let rolls: number[] = [];
  let expression: string;

  const sessionCharacter = loadCharacter();
  const matchesSession =
    caster.type === 'pc' && sessionCharacter?.name?.toLowerCase() === caster.name.toLowerCase();

  if (matchesSession) {
    const result = characterSavingThrow(sessionCharacter!, 'CON', { dc, seed });
    rolls = result.rolls;
    total = result.total;
    success = Boolean(result.success);
    expression = result.expression;
  } else {
    const modifier = caster.abilityMods?.CON ?? 0;
    const rollResult = roll('1d20', { seed });
    rolls = rollResult.rolls;
    total = rollResult.total + modifier;
    success = total >= dc;
    const modifierLabel = modifier !== 0 ? formatModifier(modifier) : '';
    expression = `1d20${modifierLabel} vs DC ${dc}`;
  }

  const rollsLabel = rolls.length === 1 ? `${rolls[0]}` : `[${rolls.join(', ')}]`;
  console.log(`Roll: ${expression}`);
  console.log(`Result: ${rollsLabel} → total ${total} → ${success ? 'SUCCESS' : 'FAILURE'}`);

  if (!success) {
    const nextState = endConcentration(encounter, caster.id);
    saveEncounter(nextState);
    console.log(`Concentration broken on ${entry.spellName}.`);
  } else {
    console.log(`Concentration maintained on ${entry.spellName}.`);
  }

  process.exit(0);
}

function handleEncounterConcentrationCommand(rawArgs: string[]): void {
  if (rawArgs.length === 0) {
    console.error('Missing encounter concentration action.');
    process.exit(1);
  }

  const [action, ...rest] = rawArgs;

  if (action === 'start') {
    handleEncounterConcentrationStartCommand(rest);
    return;
  }

  if (action === 'end') {
    handleEncounterConcentrationEndCommand(rest);
    return;
  }

  if (action === 'check') {
    handleEncounterConcentrationCheckCommand(rest);
    return;
  }

  console.error(`Unknown encounter concentration action: ${action}`);
  process.exit(1);
}

function handleEncounterRemindCommand(rawArgs: string[]): void {
  if (rawArgs.length === 0) {
    console.error('Usage: pnpm dev -- encounter remind "<Attacker>" ["<Target>"] [--event attack|save|check]');
    process.exit(1);
  }

  const [attackerIdentifier, ...rest] = rawArgs;
  if (!attackerIdentifier) {
    console.error('Attacker identifier is required for encounter remind.');
    process.exit(1);
  }

  let targetIdentifier: string | undefined;
  let optionStartIndex = 0;
  if (rest[0] && !rest[0].startsWith('--')) {
    targetIdentifier = rest[0];
    optionStartIndex = 1;
  }

  let event: ReminderEvent = 'attack';
  const optionArgs = rest.slice(optionStartIndex);

  for (let i = 0; i < optionArgs.length; i += 1) {
    const arg = optionArgs[i];
    if (!arg) {
      continue;
    }

    const lower = arg.toLowerCase();
    if (lower === '--event') {
      if (i + 1 >= optionArgs.length) {
        console.error('Expected value after --event.');
        process.exit(1);
      }
      const value = optionArgs[i + 1];
      const parsed = parseReminderEvent(value);
      if (!parsed) {
        console.error(`Unknown reminder event: ${value}. Expected one of: ${REMINDER_EVENTS.join(', ')}`);
        process.exit(1);
      }
      event = parsed;
      i += 1;
      continue;
    }

    if (lower.startsWith('--event=')) {
      const value = arg.slice('--event='.length);
      const parsed = parseReminderEvent(value);
      if (!parsed) {
        console.error(`Unknown reminder event: ${value}. Expected one of: ${REMINDER_EVENTS.join(', ')}`);
        process.exit(1);
      }
      event = parsed;
      continue;
    }

    console.warn(`Ignoring unknown argument: ${arg}`);
  }

  const encounter = requireEncounterState();
  let attacker: EncounterActor;
  try {
    attacker = findActorByIdentifier(encounter, attackerIdentifier);
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
    return;
  }

  let target: EncounterActor | undefined;
  if (targetIdentifier) {
    try {
      target = findActorByIdentifier(encounter, targetIdentifier);
    } catch (error) {
      if (error instanceof Error) {
        console.error(error.message);
      }
      process.exit(1);
      return;
    }
  }

  const reminderLines = remindersFor(encounter, attacker.id, target?.id ?? null, event);
  if (reminderLines.length === 0) {
    console.log('No reminders.');
  } else {
    reminderLines.forEach((line) => {
      console.log(line);
    });
  }

  process.exit(0);
}

type ConditionTagKey = 'prone' | 'restrained' | 'invisible';

const CONDITION_LABELS: Record<ConditionTagKey, string> = {
  prone: 'Prone',
  restrained: 'Restrained',
  invisible: 'Invisible',
};

function parseToggleValue(raw: string | undefined): boolean {
  if (!raw) {
    throw new Error('Expected <on|off> argument.');
  }
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'on' || normalized === 'true') {
    return true;
  }
  if (normalized === 'off' || normalized === 'false') {
    return false;
  }
  throw new Error(`Unknown toggle value "${raw}". Expected "on" or "off".`);
}

function handleEncounterAdvantageToggleCommand(
  rawArgs: string[],
  kind: 'advantage' | 'disadvantage',
): void {
  if (rawArgs.length < 2) {
    console.error(`Usage: pnpm dev -- encounter ${kind === 'advantage' ? 'adv' : 'dis'} "<actorIdOrName>" <on|off>`);
    process.exit(1);
  }

  const [identifier, toggle, ...rest] = rawArgs;

  if (!identifier) {
    console.error('Actor identifier is required.');
    process.exit(1);
  }

  if (rest.length > 0) {
    console.warn(`Ignoring extra argument(s): ${rest.join(', ')}`);
  }

  let turnOn: boolean;
  try {
    turnOn = parseToggleValue(toggle);
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
    return;
  }

  const encounter = requireEncounterState();

  let actor: EncounterActor;
  try {
    actor = findActorByIdentifier(encounter, identifier);
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
    return;
  }

  const tagKey = `state:${kind}`;
  const label = kind === 'advantage' ? 'Advantage' : 'Disadvantage';
  const actorTags = actor.tags ?? [];
  const matching = actorTags.filter((tag) => tag.key?.toLowerCase() === tagKey);

  let updatedEncounter: EncounterState = encounter;

  if (turnOn) {
    if (matching.length === 0) {
      updatedEncounter = encounterAddActorTag(updatedEncounter, actor.id, {
        key: tagKey,
        text: label,
        value: true,
      });
    }
  } else {
    matching.forEach((tag) => {
      updatedEncounter = encounterRemoveActorTag(updatedEncounter, actor.id, tag.id);
    });
  }

  saveEncounter(updatedEncounter);
  console.log(`${actor.name}: ${label} ${turnOn ? 'ON' : 'OFF'}`);
  process.exit(0);
}

function handleEncounterConditionTagCommand(rawArgs: string[], condition: ConditionTagKey): void {
  if (rawArgs.length < 2) {
    console.error(`Usage: pnpm dev -- encounter ${condition} "<actorIdOrName>" <on|off>`);
    process.exit(1);
  }

  const [identifier, toggle, ...rest] = rawArgs;
  if (!identifier) {
    console.error('Actor identifier is required.');
    process.exit(1);
  }

  let durationRounds: number | undefined;
  const unknownArgs: string[] = [];
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i]!;
    const lower = arg.toLowerCase();
    if (lower.startsWith('--rounds=')) {
      const value = arg.slice('--rounds='.length);
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        console.error('`--rounds` must be a positive integer.');
        process.exit(1);
      }
      durationRounds = parsed;
      continue;
    }
    if (lower === '--rounds') {
      const next = rest[i + 1];
      if (!next) {
        console.error('Expected value after --rounds.');
        process.exit(1);
      }
      const parsed = Number.parseInt(next, 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        console.error('`--rounds` must be a positive integer.');
        process.exit(1);
      }
      durationRounds = parsed;
      i += 1;
      continue;
    }
    unknownArgs.push(arg);
  }

  if (unknownArgs.length > 0) {
    console.warn(`Ignoring extra argument(s): ${unknownArgs.join(', ')}`);
  }

  let turnOn: boolean;
  try {
    turnOn = parseToggleValue(toggle);
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
    return;
  }

  const encounter = requireEncounterState();

  let actor: EncounterActor;
  try {
    actor = findActorByIdentifier(encounter, identifier);
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
    return;
  }

  const tagKey = `condition:${condition}`;
  const label = CONDITION_LABELS[condition];
  let updatedEncounter: EncounterState = encounter;

  const actorTags = actor.tags ?? [];
  const matching = actorTags.filter((tag) => tag.key?.toLowerCase() === tagKey);

  const duration = typeof durationRounds === 'number' ? { rounds: durationRounds, at: 'turnEnd' as const } : undefined;

  if (turnOn) {
    if (matching.length === 0) {
      updatedEncounter = encounterAddActorTag(updatedEncounter, actor.id, {
        key: tagKey,
        text: label,
        value: true,
        duration,
      });
    }
  } else {
    matching.forEach((tag) => {
      updatedEncounter = encounterRemoveActorTag(updatedEncounter, actor.id, tag.id);
    });
  }

  saveEncounter(updatedEncounter);
  console.log(`${actor.name}: ${label} ${turnOn ? 'ON' : 'OFF'}`);
  process.exit(0);
}

async function handleEncounterBlessCommand(rawArgs: string[]): Promise<void> {
  if (rawArgs.length < 2) {
    console.error('Usage: pnpm dev -- encounter bless "<casterIdOrName>" "A,B,C"');
    process.exit(1);
  }

  const [casterIdentifierRaw, targetsCsvRaw, ...rest] = rawArgs;

  if (rest.length > 0) {
    console.warn(`Ignoring extra argument(s): ${rest.join(', ')}`);
  }

  let encounter = requireEncounterState();

  let caster: EncounterActor;
  try {
    caster = findActorByIdentifier(encounter, casterIdentifierRaw);
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
    return;
  }

  const targetTokens = targetsCsvRaw
    .split(',')
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  if (targetTokens.length === 0) {
    console.error('Bless requires at least one target name.');
    process.exit(1);
  }

  const resolvedTargets: EncounterActor[] = [];
  const seenTargetIds = new Set<string>();
  const ignoredTargets: string[] = [];

  for (const token of targetTokens) {
    let actor: EncounterActor;
    try {
      actor = findActorByIdentifier(encounter, token);
    } catch (error) {
      if (error instanceof Error) {
        console.error(error.message);
      }
      process.exit(1);
      return;
    }

    if (seenTargetIds.has(actor.id)) {
      continue;
    }

    if (resolvedTargets.length >= 3) {
      ignoredTargets.push(actor.name);
      continue;
    }

    seenTargetIds.add(actor.id);
    resolvedTargets.push(actor);
  }

  if (resolvedTargets.length === 0) {
    console.error('Bless requires at least one unique target.');
    process.exit(1);
  }

  if (ignoredTargets.length > 0) {
    console.warn(`Bless can affect up to three targets; ignoring: ${ignoredTargets.join(', ')}`);
  }

  try {
    encounter = startBless(
      encounter,
      caster.id,
      resolvedTargets.map((actor) => actor.id),
    );
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
    return;
  }

  saveEncounter(encounter);

  const entry = encounter.concentration?.[caster.id];
  const appliedTargets = entry?.targetIds ?? resolvedTargets.map((actor) => actor.id);
  const appliedNames = appliedTargets.map((id) => encounter.actors[id]?.name ?? id);
  const message = `Bless applied: ${caster.name} → ${appliedNames.join(', ')} (concentration started)`;
  console.log(message);
  await logIfEnabled(`${message}.`);
  process.exit(0);
}

async function handleEncounterGuidanceCommand(rawArgs: string[]): Promise<void> {
  if (rawArgs.length < 2) {
    console.error('Usage: pnpm dev -- encounter guidance "<casterIdOrName>" "<targetIdOrName>"');
    process.exit(1);
  }

  const [casterIdentifierRaw, targetIdentifierRaw, ...rest] = rawArgs;

  if (rest.length > 0) {
    console.warn(`Ignoring extra argument(s): ${rest.join(', ')}`);
  }

  let encounter = requireEncounterState();

  let caster: EncounterActor;
  let target: EncounterActor;
  try {
    caster = findActorByIdentifier(encounter, casterIdentifierRaw);
    target = findActorByIdentifier(encounter, targetIdentifierRaw);
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
    return;
  }

  try {
    encounter = startGuidance(encounter, caster.id, target.id);
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
    return;
  }

  saveEncounter(encounter);
  const message = `Guidance applied: ${caster.name} → ${target.name} (concentration started)`;
  console.log(message);
  await logIfEnabled(`${message}.`);
  process.exit(0);
}

async function handleEncounterInspireCommand(rawArgs: string[]): Promise<void> {
  if (rawArgs.length < 2) {
    console.error(
      'Usage: pnpm dev -- encounter inspire "<bardIdOrName>" "<targetIdOrName>" [--die d6|d8|d10|d12] [--auto-clear]',
    );
    process.exit(1);
  }

  const [bardIdentifierRaw, targetIdentifierRaw, ...optionArgs] = rawArgs;

  let requestedDie: string | undefined;
  let autoClear = false;
  for (let i = 0; i < optionArgs.length; i += 1) {
    const arg = optionArgs[i];
    if (!arg) {
      continue;
    }

    const lower = arg.toLowerCase();
    if (lower === '--die') {
      if (i + 1 >= optionArgs.length) {
        console.error('Expected value after --die.');
        process.exit(1);
      }
      requestedDie = optionArgs[i + 1];
      i += 1;
      continue;
    }

    if (lower.startsWith('--die=')) {
      requestedDie = arg.slice('--die='.length);
      continue;
    }

    if (lower === '--auto-clear') {
      autoClear = true;
      continue;
    }

    if (lower.startsWith('--auto-clear=')) {
      const value = arg.slice('--auto-clear='.length).toLowerCase();
      autoClear = value === 'true' || value === '1' || value === 'yes' || value === 'on';
      continue;
    }

    console.warn(`Ignoring unknown argument: ${arg}`);
  }

  let encounter = requireEncounterState();

  let bard: EncounterActor;
  let target: EncounterActor;
  try {
    bard = findActorByIdentifier(encounter, bardIdentifierRaw);
    target = findActorByIdentifier(encounter, targetIdentifierRaw);
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
    return;
  }

  try {
    encounter = applyBardicInspiration(encounter, bard.id, target.id, {
      die: requestedDie,
      autoClear,
    });
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
    return;
  }

  const updatedTarget = encounter.actors[target.id];
  const inspirationTag = updatedTarget?.tags?.find((tag) => {
    const key = tag.key?.toLowerCase();
    if (key === 'bardic-inspiration') {
      return true;
    }
    const text = tag.text?.toLowerCase();
    return text === 'bardic inspiration';
  });
  const die = bardicInspirationDieFromTag(inspirationTag);

  saveEncounter(encounter);
  const suffix = autoClear ? ', auto-clear' : '';
  const message = `Bardic Inspiration applied: ${bard.name} → ${target.name} (+${die}${suffix})`;
  console.log(message);
  await logIfEnabled(`${message}.`);
  process.exit(0);
}

function handleEncounterInspireUseCommand(rawArgs: string[]): void {
  if (rawArgs.length < 1) {
    console.error('Usage: pnpm dev -- encounter inspire use "<targetIdOrName>"');
    process.exit(1);
  }

  const [targetIdentifierRaw, ...rest] = rawArgs;

  if (rest.length > 0) {
    console.warn(`Ignoring extra argument(s): ${rest.join(', ')}`);
  }

  let encounter = requireEncounterState();

  let target: EncounterActor;
  try {
    target = findActorByIdentifier(encounter, targetIdentifierRaw);
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
    return;
  }

  const consumption = consumeBardicInspiration(encounter, target.id);
  if (!consumption.consumed || !consumption.removedTag) {
    console.log(`${target.name} has no Bardic Inspiration.`);
    process.exit(0);
    return;
  }

  encounter = consumption.state;
  saveEncounter(encounter);

  const die = bardicInspirationDieFromTag(consumption.removedTag);
  console.log(`Using Bardic Inspiration on ${target.name}: add +${die} (after seeing the roll).`);
  process.exit(0);
}

function handleEncounterInspireClearCommand(rawArgs: string[]): void {
  if (rawArgs.length < 1) {
    console.error('Usage: pnpm dev -- encounter inspire-clear "<targetIdOrName>"');
    process.exit(1);
  }

  const [targetIdentifierRaw, ...rest] = rawArgs;

  if (rest.length > 0) {
    console.warn(`Ignoring extra argument(s): ${rest.join(', ')}`);
  }

  let encounter = requireEncounterState();

  let target: EncounterActor;
  try {
    target = findActorByIdentifier(encounter, targetIdentifierRaw);
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
    return;
  }

  const before = encounter.actors[target.id];
  const hadBefore = hasBardicInspiration(before?.tags);

  encounter = clearBardicInspiration(encounter, target.id);

  const after = encounter.actors[target.id];
  const hasAfter = hasBardicInspiration(after?.tags);

  saveEncounter(encounter);

  if (hadBefore && !hasAfter) {
    console.log(`Bardic Inspiration cleared from ${target.name}.`);
  } else if (!hadBefore) {
    console.log(`${target.name} had no Bardic Inspiration.`);
  } else {
    console.log(`Bardic Inspiration remains on ${target.name}.`);
  }

  process.exit(0);
}

async function handleEncounterMarkCommand(rawArgs: string[]): Promise<void> {
  if (rawArgs.length < 2) {
    console.error(
      'Usage: pnpm dev -- encounter mark "<rangerIdOrName>" "<targetIdOrName>" [--note "<detail>"]',
    );
    process.exit(1);
  }

  const [casterIdentifierRaw, targetIdentifierRaw, ...rest] = rawArgs;

  let noteText: string | undefined;
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (!arg) {
      continue;
    }
    const lower = arg.toLowerCase();
    if (lower === '--note') {
      if (i + 1 >= rest.length) {
        console.error('Expected value after --note.');
        process.exit(1);
      }
      noteText = rest[i + 1];
      i += 1;
      continue;
    }
    if (lower.startsWith('--note=')) {
      noteText = arg.slice(arg.indexOf('=') + 1);
      continue;
    }
    console.warn(`Ignoring unknown argument: ${arg}`);
  }

  let encounter = requireEncounterState();
  let caster: EncounterActor;
  let target: EncounterActor;
  try {
    caster = findActorByIdentifier(encounter, casterIdentifierRaw);
    target = findActorByIdentifier(encounter, targetIdentifierRaw);
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
    return;
  }

  const source = `conc:${caster.id}:Hunter's Mark`;
  for (const actor of Object.values(encounter.actors)) {
    const tags = actor.tags ?? [];
    for (const tag of tags) {
      if (tag.source === source) {
        encounter = encounterRemoveActorTag(encounter, actor.id, tag.id);
        console.log(`Removed tag ${tag.id} from ${actor.name}: "Hunter's Mark"`);
      }
    }
  }

  encounter = startConcentration(encounter, {
    casterId: caster.id,
    spellName: "Hunter's Mark",
    targetId: target.id,
  });

  const tag: Omit<ActorTag, 'id' | 'addedAtRound'> = {
    text: "Hunter's Mark",
    note: noteText ?? 'Add 1d6 to your weapon damage rolls against this target',
    source,
  };
  encounter = encounterAddActorTag(encounter, target.id, tag);

  saveEncounter(encounter);
  console.log(`Started concentration: Hunter's Mark (${caster.name}) → target ${target.name}`);
  console.log(`Added tag to ${target.name}: "Hunter's Mark" [${source}]`);
  const summary = `Hunter's Mark started: ${caster.name} → ${target.name}`;
  const noteSuffix = noteText ? ` — ${noteText}` : '';
  await logIfEnabled(`${summary}${noteSuffix}.`);
  process.exit(0);
}

function requireConditionName(raw: string | undefined): Condition {
  if (!raw) {
    console.error(`Condition name is required. Expected one of: ${CONDITION_NAMES.join(', ')}`);
    process.exit(1);
  }
  const parsed = parseConditionName(raw);
  if (!parsed) {
    console.error(`Unknown condition: ${raw}. Expected one of: ${CONDITION_NAMES.join(', ')}`);
    process.exit(1);
  }
  return parsed;
}

function handleEncounterConditionAddCommand(rawIdentifier: string | undefined, rawCondition: string | undefined): void {
  if (!rawIdentifier) {
    console.error('Usage: pnpm dev -- encounter condition add "<actorIdOrName>" <condition>');
    process.exit(1);
  }

  const condition = requireConditionName(rawCondition);
  let encounter = requireEncounterState();
  let actor: EncounterActor;
  try {
    actor = findActorByIdentifier(encounter, rawIdentifier);
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
  }

  const alreadyHad = hasCondition(actor.conditions, condition);
  encounter = encounterSetCondition(encounter, actor.id, condition);
  saveEncounter(encounter);

  const updated = encounter.actors[actor.id];
  const label = formatConditionList(updated?.conditions);
  if (alreadyHad) {
    console.log(`${actor.name} (id=${actor.id}) already had ${condition}. Conditions: ${label}.`);
  } else {
    console.log(`Added ${condition} to ${actor.name} (id=${actor.id}). Conditions: ${label}.`);
  }
  process.exit(0);
}

function handleEncounterConditionRemoveCommand(rawIdentifier: string | undefined, rawCondition: string | undefined): void {
  if (!rawIdentifier) {
    console.error('Usage: pnpm dev -- encounter condition remove "<actorIdOrName>" <condition>');
    process.exit(1);
  }

  const condition = requireConditionName(rawCondition);
  let encounter = requireEncounterState();
  let actor: EncounterActor;
  try {
    actor = findActorByIdentifier(encounter, rawIdentifier);
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
  }

  const hadCondition = hasCondition(actor.conditions, condition);
  encounter = encounterClearCondition(encounter, actor.id, condition);
  saveEncounter(encounter);

  const updated = encounter.actors[actor.id];
  const label = formatConditionList(updated?.conditions);
  if (hadCondition) {
    console.log(`Removed ${condition} from ${actor.name} (id=${actor.id}). Conditions: ${label}.`);
  } else {
    console.log(`${actor.name} (id=${actor.id}) did not have ${condition}. Conditions: ${label}.`);
  }
  process.exit(0);
}

function handleEncounterConditionListCommand(): void {
  const encounter = requireEncounterState();
  const actors = sortActorsForListing(encounter);

  if (actors.length === 0) {
    console.log('No actors in the encounter.');
    process.exit(0);
  }

  console.log('Conditions:');
  actors.forEach((actor) => {
    console.log(`${actor.name} (id=${actor.id}): ${formatConditionList(actor.conditions)}`);
  });
  process.exit(0);
}

function handleEncounterConditionCommand(rawArgs: string[]): void {
  if (rawArgs.length === 0) {
    console.error('Usage: pnpm dev -- encounter condition <add|remove|list> ...');
    process.exit(1);
  }

  const [action, ...rest] = rawArgs;
  if (action === 'list') {
    handleEncounterConditionListCommand();
    return;
  }
  if (action === 'add') {
    const [identifier, condition] = rest;
    handleEncounterConditionAddCommand(identifier, condition);
    return;
  }
  if (action === 'remove') {
    const [identifier, condition] = rest;
    handleEncounterConditionRemoveCommand(identifier, condition);
    return;
  }

  console.error(`Unknown encounter condition action: ${action}`);
  process.exit(1);
}

function handleEncounterNoteAddCommand(rawArgs: string[]): void {
  if (rawArgs.length < 2) {
    console.error('Usage: pnpm dev -- encounter note add "<actorIdOrName>" "<text>" [--rounds N] [--note "<detail>"] [--source "<who/what>"]');
    process.exit(1);
  }

  const identifier = rawArgs[0]!;
  const text = rawArgs[1]!;
  const rest = rawArgs.slice(2);
  if (!text.trim()) {
    console.error('Tag text cannot be empty.');
    process.exit(1);
  }

  let rounds: number | undefined;
  let note: string | undefined;
  let source: string | undefined;

  try {
    for (let i = 0; i < rest.length; i += 1) {
      const arg = rest[i];
      const lower = arg.toLowerCase();

      if (arg.startsWith('--rounds=')) {
        rounds = parsePositiveInteger(arg.slice('--rounds='.length), '--rounds');
        continue;
      }

      if (lower === '--rounds') {
        if (i + 1 >= rest.length) {
          console.error('Expected value after --rounds.');
          process.exit(1);
        }
        rounds = parsePositiveInteger(rest[i + 1], '--rounds');
        i += 1;
        continue;
      }

      if (arg.startsWith('--note=')) {
        note = arg.slice('--note='.length);
        continue;
      }

      if (lower === '--note') {
        if (i + 1 >= rest.length) {
          console.error('Expected value after --note.');
          process.exit(1);
        }
        note = rest[i + 1];
        i += 1;
        continue;
      }

      if (arg.startsWith('--source=')) {
        source = arg.slice('--source='.length);
        continue;
      }

      if (lower === '--source') {
        if (i + 1 >= rest.length) {
          console.error('Expected value after --source.');
          process.exit(1);
        }
        source = rest[i + 1];
        i += 1;
        continue;
      }

      console.warn(`Ignoring unknown argument: ${arg}`);
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error('Failed to parse note options.');
    }
    process.exit(1);
  }

  let encounter = requireEncounterState();
  let actor: EncounterActor;
  try {
    actor = findActorByIdentifier(encounter, identifier);
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
    return;
  }

  const expiresAtRound = typeof rounds === 'number' ? encounter.round + (rounds - 1) : undefined;
  const existingIds = new Set((actor.tags ?? []).map((tag) => tag.id));
  encounter = encounterAddActorTag(encounter, actor.id, { text, expiresAtRound, note, source });
  saveEncounter(encounter);

  const updated = encounter.actors[actor.id];
  const added = updated?.tags?.find((tag) => !existingIds.has(tag.id));
  if (!added) {
    console.error('Failed to create tag.');
    process.exit(1);
  }

  const expiryLabel = typeof added.expiresAtRound === 'number' ? ` (expires at round ${added.expiresAtRound})` : '';
  console.log(`Added tag ${added.id} to ${actor.name} (id=${actor.id}): "${added.text}"${expiryLabel}.`);
  process.exit(0);
}

function handleEncounterNoteListCommand(): void {
  const encounter = requireEncounterState();
  const actors = sortActorsForListing(encounter);

  if (actors.length === 0) {
    console.log('No actors in the encounter.');
    process.exit(0);
  }

  console.log('Actor tags:');
  actors.forEach((actor) => {
    const tags = sortActorTags(actor.tags);
    if (tags.length === 0) {
      console.log(`${actor.name} (id=${actor.id}): —`);
      return;
    }
    console.log(`${actor.name} (id=${actor.id}):`);
    tags.forEach((tag) => {
      console.log(`  - ${formatTagDetail(tag)}`);
    });
  });
  process.exit(0);
}

function handleEncounterNoteRemoveCommand(rawArgs: string[]): void {
  if (rawArgs.length < 2) {
    console.error('Usage: pnpm dev -- encounter note remove "<actorIdOrName>" <tagId>');
    process.exit(1);
  }

  const identifier = rawArgs[0]!;
  const tagId = rawArgs[1]!;
  let encounter = requireEncounterState();
  let actor: EncounterActor;
  try {
    actor = findActorByIdentifier(encounter, identifier);
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
    return;
  }

  const hasTag = (actor.tags ?? []).some((tag) => tag.id === tagId);
  if (!hasTag) {
    console.error(`Tag ${tagId} not found for ${actor.name} (id=${actor.id}).`);
    process.exit(1);
  }

  encounter = encounterRemoveActorTag(encounter, actor.id, tagId);
  saveEncounter(encounter);
  const updated = encounter.actors[actor.id];
  console.log(`Removed tag ${tagId} from ${actor.name} (id=${actor.id}). Remaining tags: ${formatActorTags(updated?.tags)}.`);
  process.exit(0);
}

function handleEncounterNoteClearCommand(rawArgs: string[]): void {
  if (rawArgs.length < 1) {
    console.error('Usage: pnpm dev -- encounter note clear "<actorIdOrName>"');
    process.exit(1);
  }

  const identifier = rawArgs[0]!;
  let encounter = requireEncounterState();
  let actor: EncounterActor;
  try {
    actor = findActorByIdentifier(encounter, identifier);
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
    return;
  }

  if (!actor.tags || actor.tags.length === 0) {
    console.log(`${actor.name} (id=${actor.id}) has no tags to clear.`);
    process.exit(0);
  }

  encounter = encounterClearActorTags(encounter, actor.id);
  saveEncounter(encounter);
  console.log(`Cleared all tags for ${actor.name} (id=${actor.id}).`);
  process.exit(0);
}

function handleEncounterNoteCommand(rawArgs: string[]): void {
  if (rawArgs.length === 0) {
    console.error('Usage: pnpm dev -- encounter note <add|list|remove|clear> ...');
    process.exit(1);
  }

  const [action, ...rest] = rawArgs;
  if (action === 'add') {
    handleEncounterNoteAddCommand(rest);
    return;
  }
  if (action === 'list') {
    handleEncounterNoteListCommand();
    return;
  }
  if (action === 'remove') {
    handleEncounterNoteRemoveCommand(rest);
    return;
  }
  if (action === 'clear') {
    handleEncounterNoteClearCommand(rest);
    return;
  }

  console.error(`Unknown encounter note action: ${action}`);
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

function handleEncounterInitRollCommand(): void {
  let encounter = requireEncounterState();
  encounter = rollEncounterInitiative(encounter);
  saveEncounter(encounter);

  console.log('Initiative rolled.');
  process.exit(0);
}

function handleEncounterInitShowCommand(): void {
  const encounter = loadEncounter();
  if (!encounter) {
    console.log('No encounter in progress.');
    process.exit(0);
  }

  if (encounter.order.length === 0) {
    console.log('No initiative order set.');
    process.exit(0);
  }

  encounter.order.forEach((entry, index) => {
    const actor = encounter.actors[entry.actorId];
    const name = actor ? actor.name : entry.actorId;
    console.log(`${index + 1}. ${name} — ${entry.total}`);
  });
  process.exit(0);
}

function handleEncounterInitSetCommand(args: string[]): void {
  if (args.length < 2) {
    console.error('Usage: pnpm dev -- encounter init set "<Name>" <Score>');
    process.exit(1);
  }

  const scoreRaw = args[args.length - 1]!;
  const name = args.slice(0, -1).join(' ').trim();
  const score = Number.parseInt(scoreRaw, 10);
  if (!Number.isFinite(score)) {
    console.error('Score must be a valid integer.');
    process.exit(1);
  }

  let encounter = requireEncounterState();
  let actorId: string;
  try {
    actorId = getActorIdByName(encounter, name);
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(String(error));
    }
    process.exit(1);
    return;
  }

  try {
    encounter = setEncounterInitiative(encounter, actorId, score);
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(String(error));
    }
    process.exit(1);
  }

  saveEncounter(encounter);
  console.log(`Set ${name} to ${score}`);
  process.exit(0);
}

function handleEncounterInitClearCommand(): void {
  let encounter = requireEncounterState();
  encounter = clearEncounterInitiative(encounter);
  saveEncounter(encounter);

  console.log('Initiative cleared.');
  process.exit(0);
}

function handleEncounterInitCommand(rawArgs: string[]): void {
  if (rawArgs.length === 0) {
    console.error('Missing encounter init subcommand.');
    process.exit(1);
  }

  const [subcommand, ...rest] = rawArgs;
  if (subcommand === 'roll') {
    handleEncounterInitRollCommand();
    return;
  }

  if (subcommand === 'show') {
    handleEncounterInitShowCommand();
    return;
  }

  if (subcommand === 'set') {
    handleEncounterInitSetCommand(rest);
    return;
  }

  if (subcommand === 'clear') {
    handleEncounterInitClearCommand();
    return;
  }

  console.error(`Unknown encounter init subcommand: ${subcommand}`);
  process.exit(1);
}

async function handleEncounterNextCommand(): Promise<void> {
  let encounter = requireEncounterState();
  const previousTags = collectActorTags(encounter);
  encounter = encounterNextTurn(encounter);
  const expired = diffExpiredTags(previousTags, encounter);
  saveEncounter(encounter);

  const actor = encounterCurrentActor(encounter);
  const consoleLine = actor
    ? `Round ${encounter.round} — ${actor.name}'s turn`
    : `Round ${encounter.round} — no active actor`;
  console.log(consoleLine);
  await logIfEnabled(`${consoleLine}.`);
  expired.forEach(({ actorId, tag }) => {
    const name = encounter.actors[actorId]?.name ?? actorId;
    const label = tag.key ?? tag.text ?? tag.id;
    console.log(`Effect expired: ${label} (${name})`);
  });
  process.exit(0);
}

async function handleEncounterPrevCommand(): Promise<void> {
  let encounter = requireEncounterState();
  const previousTags = collectActorTags(encounter);
  encounter = encounterPreviousTurn(encounter);
  const expired = diffExpiredTags(previousTags, encounter);
  saveEncounter(encounter);

  const actor = encounterCurrentActor(encounter);
  const consoleLine = actor
    ? `Round ${encounter.round} — ${actor.name}'s turn`
    : `Round ${encounter.round} — no active actor`;
  console.log(consoleLine);
  await logIfEnabled(`${consoleLine}.`);
  expired.forEach(({ actorId, tag }) => {
    const name = encounter.actors[actorId]?.name ?? actorId;
    const label = tag.key ?? tag.text ?? tag.id;
    console.log(`Effect expired: ${label} (${name})`);
  });
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

  if (name.toLowerCase() === 'current') {
    console.error('Encounter save name "current" is reserved.');
    process.exit(1);
  }

  if (/[\\/]/.test(name)) {
    console.error('Encounter save name cannot contain path separators.');
    process.exit(1);
  }

  const encounter = loadEncounter();
  if (!encounter) {
    console.error('No encounter in progress. Use `pnpm dev -- encounter start` first.');
    process.exit(1);
  }

  const filePath = saveEncounterAs(name, encounter);
  const relativePath = relative(process.cwd(), filePath);
  console.log(`Saved encounter → ${relativePath}`);
  process.exit(0);
}

function handleEncounterListSnapshotsCommand(): void {
  const saves = listEncounterSaves();
  if (saves.length === 0) {
    console.log('(no snapshots)');
    process.exit(0);
  }

  saves.forEach((save) => {
    console.log(save);
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
  const actorCount = Object.keys(encounter.actors ?? {}).length;
  console.log(`Loaded encounter '${name}' with ${actorCount} actors.`);
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

function handleEncounterCheckCommand(rawArgs: string[]): void {
  if (rawArgs.length < 2) {
    console.error(
      'Usage: pnpm dev -- encounter check "<actorIdOrName>" <ABILITY> [--dc <n>] [--skill "<SkillName>"] [--adv|--dis] [--seed <value>]',
    );
    process.exit(1);
  }

  const [identifierRaw, abilityRaw, ...rest] = rawArgs;
  const abilityUpper = abilityRaw.toUpperCase();
  if (!isAbilityName(abilityUpper)) {
    console.error(`Invalid ability name: ${abilityRaw}`);
    process.exit(1);
  }

  let dc: number | undefined;
  let skill: SkillName | undefined;
  let advantage = false;
  let disadvantage = false;
  let seed: string | undefined;

  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    const lower = arg.toLowerCase();

    if (lower === '--dc') {
      dc = parseSignedInteger(rest[i + 1], '--dc');
      i += 1;
      continue;
    }

    if (arg.startsWith('--dc=')) {
      dc = parseSignedInteger(arg.slice('--dc='.length), '--dc');
      continue;
    }

    if (lower === '--skill') {
      const value = rest[i + 1];
      if (value === undefined) {
        console.error('Expected value after --skill.');
        process.exit(1);
      }
      const parsed = normalizeSkillName(value);
      if (!parsed) {
        console.error(`Unknown skill: ${value}`);
        process.exit(1);
      }
      skill = parsed;
      i += 1;
      continue;
    }

    if (arg.startsWith('--skill=')) {
      const value = arg.slice('--skill='.length);
      const parsed = normalizeSkillName(value);
      if (!parsed) {
        console.error(`Unknown skill: ${value}`);
        process.exit(1);
      }
      skill = parsed;
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

    if (lower === '--seed') {
      if (i + 1 >= rest.length) {
        console.error('Expected value after --seed.');
        process.exit(1);
      }
      seed = rest[i + 1];
      i += 1;
      continue;
    }

    if (arg.startsWith('--seed=')) {
      seed = arg.slice('--seed='.length);
      continue;
    }

    console.warn(`Ignoring unknown argument: ${arg}`);
  }

  if (advantage && disadvantage) {
    console.error('Cannot roll with both advantage and disadvantage.');
    process.exit(1);
  }

  const encounter = requireEncounterState();
  let actor: EncounterActor;
  try {
    actor = findActorByIdentifier(encounter, identifierRaw);
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
    return;
  }

  const ability = abilityUpper as AbilityName;
  let abilityUsed: AbilityName = ability;
  let skillUsed: SkillName | undefined;
  if (skill) {
    abilityUsed = skillAbility(skill);
    skillUsed = skill;
  }

  const sessionCharacter = loadCharacter();
  const matchesSession =
    actor.type === 'pc' &&
    sessionCharacter?.name &&
    sessionCharacter.name.toLowerCase() === actor.name.toLowerCase();

  let baseMod = actor.abilityMods?.[abilityUsed] ?? 0;

  if (matchesSession) {
    const mods = abilityMods(sessionCharacter!.abilities);
    baseMod = mods[abilityUsed] ?? 0;
    if (skillUsed) {
      const pb = proficiencyBonusForLevel(sessionCharacter!.level);
      const proficient = isProficientSkill(sessionCharacter!, skillUsed);
      const expertise = hasExpertise(sessionCharacter!, skillUsed);
      if (proficient) {
        baseMod += expertise ? pb * 2 : pb;
      }
    }
  }

  const conditionFlags = hasCondition(actor.conditions, 'poisoned') ? { disadvantage: true } : {};
  const combinedFlags = combineAdvantage({ advantage, disadvantage }, conditionFlags);
  const conditionNotes: string[] = [];
  if (conditionFlags.disadvantage && combinedFlags.disadvantage) {
    conditionNotes.push('disadvantage from poisoned');
  }

  const result = encounterAbilityCheck(encounter, {
    actorId: actor.id,
    ability: abilityUsed,
    baseMod,
    dc,
    advantage,
    disadvantage,
    seed,
  });

  const skillSummary = skillUsed ? ` [skill: ${skillUsed} (${skillAbility(skillUsed)})]` : '';
  const dcLabel = typeof dc === 'number' ? ` vs DC ${dc}` : '';
  console.log(`Check: ${actor.name} ${abilityUsed}${skillSummary}${dcLabel}`);

  const rollsLabel = `[${result.rolls.join(', ')}]`;
  let resultLine = `Rolls: ${rollsLabel} → total ${result.total}`;
  if (typeof result.success === 'boolean') {
    resultLine += ` → ${result.success ? 'SUCCESS' : 'FAILURE'}`;
  }
  console.log(resultLine);

  if (conditionNotes.length > 0) {
    console.log(`(conditions: ${conditionNotes.join(', ')})`);
  }

  const consumption = consumeBardicInspiration(encounter, actor.id, { autoOnly: true });
  if (consumption.consumed) {
    encounter = consumption.state;
    saveEncounter(encounter);
    console.log('(Bardic Inspiration consumed.)');
  }

  process.exit(0);
}

async function handleEncounterAttackCommand(rawArgs: string[]): Promise<void> {
  if (rawArgs.length < 2) {
    console.error(
      'Usage: pnpm dev -- encounter attack "<attacker>" "<defender>" [--mode melee|ranged] [--adv|--dis] [--twohanded] [--respect-adv] [--seed <value>]',
    );
    process.exit(1);
  }

  const [attackerRaw, defenderRaw, ...rest] = rawArgs;
  let advantage = false;
  let disadvantage = false;
  let twoHanded = false;
  let seed: string | undefined;
  let mode: 'melee' | 'ranged' = 'melee';
  let respectAdvOverride = false;

  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    const lower = arg.toLowerCase();

    if (lower === '--mode') {
      if (i + 1 >= rest.length) {
        console.error('Expected value after --mode.');
        process.exit(1);
      }
      const value = rest[i + 1]?.toLowerCase();
      if (value === 'melee' || value === 'ranged') {
        mode = value;
      } else {
        console.error('Mode must be either "melee" or "ranged".');
        process.exit(1);
      }
      i += 1;
      continue;
    }

    if (lower.startsWith('--mode=')) {
      const value = arg.slice('--mode='.length).toLowerCase();
      if (value === 'melee' || value === 'ranged') {
        mode = value as 'melee' | 'ranged';
      } else {
        console.error('Mode must be either "melee" or "ranged".');
        process.exit(1);
      }
      continue;
    }

    if (lower === '--melee') {
      mode = 'melee';
      continue;
    }

    if (lower === '--ranged') {
      mode = 'ranged';
      continue;
    }

    if (lower === '--respect-adv') {
      respectAdvOverride = true;
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
    return;
  }

  if (encounter.defeated.has(attacker.id) || attacker.hp <= 0) {
    console.error(`${attacker.name} (id=${attacker.id}) is defeated and cannot attack.`);
    process.exit(1);
  }

  if (encounter.defeated.has(defender.id) || defender.hp <= 0) {
    console.error(`${defender.name} (id=${defender.id}) is defeated. Choose an active target.`);
    process.exit(1);
  }

  const effectiveMode = mode;
  const conditionFlags = attackAdvFromConditions(attacker.conditions, defender.conditions, effectiveMode);
  const combinedFlags = combineAdvantage({ advantage, disadvantage }, conditionFlags);
  const conditionEffects = describeConditionEffects(attacker, defender, effectiveMode);
  let conditionSummary = 'none';
  if (conditionEffects.length > 0) {
    conditionSummary = conditionEffects.join('; ');
    if (conditionFlags.advantage && conditionFlags.disadvantage) {
      conditionSummary = `${conditionSummary} → cancel`;
    }
  }

  const settings = await loadSettings();
  const useAdvantageAutomation = Boolean(settings.respectAdv) || respectAdvOverride;

  let computedAdvState: 'normal' | 'advantage' | 'disadvantage' = 'normal';
  if (useAdvantageAutomation) {
    computedAdvState = computeAdvantageState(encounter, attacker.id, defender.id, effectiveMode);
  }

  const hasComputedAdvantage = useAdvantageAutomation && computedAdvState === 'advantage';
  const hasComputedDisadvantage = useAdvantageAutomation && computedAdvState === 'disadvantage';

  const totalAdvantage = advantage || hasComputedAdvantage;
  const totalDisadvantage = disadvantage || hasComputedDisadvantage;

  const finalAdvState: 'normal' | 'advantage' | 'disadvantage' =
    totalAdvantage && !totalDisadvantage
      ? 'advantage'
      : totalDisadvantage && !totalAdvantage
      ? 'disadvantage'
      : 'normal';

  const fallbackState = combinedFlags.advantage
    ? 'advantage'
    : combinedFlags.disadvantage
    ? 'disadvantage'
    : 'normal';

  const reminderLines = remindersFor(encounter, attacker.id, defender.id, 'attack');

  const attackOptions: {
    advantage?: boolean;
    disadvantage?: boolean;
    twoHanded?: boolean;
    seed?: string;
    mode?: 'melee' | 'ranged';
    advStateOverride?: 'normal' | 'advantage' | 'disadvantage';
  } = {
    advantage,
    disadvantage,
    twoHanded,
    seed,
    mode: effectiveMode,
  };

  if (useAdvantageAutomation) {
    attackOptions.advStateOverride = finalAdvState;
  }

  const result = encounterActorAttack(encounter, attacker.id, defender.id, attackOptions);

  encounter = result.state;
  const autoConsumption = consumeBardicInspiration(encounter, attacker.id, { autoOnly: true });
  encounter = autoConsumption.state;
  saveEncounter(encounter);

  const displayAdvState = useAdvantageAutomation ? finalAdvState : fallbackState;

  console.log(`Mode: ${effectiveMode} (conditions: ${conditionSummary})`);
  if (useAdvantageAutomation) {
    console.log(`Advantage state: ${displayAdvState}`);
  } else {
    console.log(`Advantage state: ${displayAdvState} (respectAdv OFF)`);
  }

  const outcome = getAttackOutcome(result.attack);
  for (const line of reminderLines) {
    console.log(line);
  }
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

  const damageApplied =
    result.damage && (result.attack.isCrit || result.attack.hit === true) ? result.damage.finalTotal : 0;
  if (damageApplied > 0) {
    const reminderLines = concentrationReminderLinesForDamage(encounter, defender.id, damageApplied);
    for (const line of reminderLines) {
      console.log(line);
    }
  }

  const updatedDefender = encounter.actors[defender.id];
  if (updatedDefender) {
    const status = encounter.defeated.has(defender.id) ? 'DEFEATED' : 'active';
    console.log(
      `Defender ${updatedDefender.name} (id=${updatedDefender.id}) now has ${formatHitPoints(updatedDefender)} HP (${status}).`,
    );
  }

  if (autoConsumption.consumed) {
    console.log('(Bardic Inspiration consumed.)');
  }

  const acTarget = typeof targetAC === 'number' ? targetAC : defender.ac;
  const rollLabel = `roll ${result.attack.total}`;
  let descriptor: string;
  if (result.attack.isCrit) {
    descriptor = `critical hit${typeof acTarget === 'number' ? ` vs AC ${acTarget}` : ''}`;
  } else if (result.attack.hit === true) {
    descriptor = `hit${typeof acTarget === 'number' ? ` AC ${acTarget}` : ''}`;
  } else if (result.attack.hit === false) {
    descriptor = `missed${typeof acTarget === 'number' ? ` vs AC ${acTarget}` : ''}`;
  } else {
    descriptor = 'attacked';
  }
  const damageInfo = damageApplied > 0 ? ` for ${damageApplied} damage` : '';
  const attackSummary = `${attacker.name} attacked ${defender.name}: ${descriptor} (${rollLabel})${damageInfo}.`;
  await logIfEnabled(attackSummary);

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

async function handleEncounterEndCommand(): Promise<void> {
  clearEncounter();
  const line = 'Encounter ended.';
  console.log(line);
  await logIfEnabled(line);
  process.exit(0);
}

async function handleSettingsCommand(rawArgs: string[]): Promise<void> {
  if (rawArgs.length === 0) {
    console.error('Missing settings subcommand.');
    showUsage();
    process.exit(1);
  }

  const [subcommand, ...rest] = rawArgs;
  if (subcommand === 'get') {
    const settings = await loadSettings();
    console.log(JSON.stringify(settings, null, 2));
    process.exit(0);
  }

  if (subcommand === 'set') {
    if (rest.length === 0) {
      console.error('Missing setting name.');
      process.exit(1);
    }
    const [settingName, valueRaw, ...extra] = rest;
    if (!valueRaw) {
      console.error('Missing value for settings set command.');
      process.exit(1);
    }
    if (extra.length > 0) {
      console.warn(`Ignoring extra argument(s): ${extra.join(', ')}`);
    }

    const normalizedName = settingName.trim().toLowerCase();
    const normalizedValue = valueRaw.trim().toLowerCase();

    if (normalizedValue !== 'on' && normalizedValue !== 'off') {
      console.error("Value must be 'on' or 'off'.");
      process.exit(1);
    }

    const boolValue = normalizedValue === 'on';
    const settings = await loadSettings();
    if (normalizedName === 'respect-adv') {
      settings.respectAdv = boolValue;
      await saveSettings(settings);
      console.log(`respectAdv = ${settings.respectAdv ? 'ON' : 'OFF'}`);
      process.exit(0);
    }

    if (normalizedName === 'auto-log') {
      settings.autoLog = boolValue;
      await saveSettings(settings);
      console.log(`autoLog = ${settings.autoLog ? 'ON' : 'OFF'}`);
      process.exit(0);
    }

    console.error(`Unknown setting: ${settingName}`);
    process.exit(1);
  }

  console.error(`Unknown settings subcommand: ${subcommand}`);
  process.exit(1);
}

async function handleSessionCommand(rawArgs: string[]): Promise<void> {
  if (rawArgs.length === 0) {
    console.error('Missing session subcommand.');
    process.exit(1);
  }

  const [subcommand, ...rest] = rawArgs;

  if (subcommand === 'tail') {
    let count = 20;

    for (let i = 0; i < rest.length; i += 1) {
      const arg = rest[i];
      if (!arg) {
        continue;
      }

      if (arg.startsWith('--n=')) {
        const value = Number.parseInt(arg.slice('--n='.length), 10);
        if (!Number.isFinite(value) || value <= 0) {
          console.error('--n must be a positive integer.');
          process.exit(1);
        }
        count = value;
        continue;
      }

      if (arg === '--n') {
        const next = rest[i + 1];
        if (next === undefined) {
          console.error('Expected value after --n.');
          process.exit(1);
        }
        const value = Number.parseInt(next, 10);
        if (!Number.isFinite(value) || value <= 0) {
          console.error('--n must be a positive integer.');
          process.exit(1);
        }
        count = value;
        i += 1;
        continue;
      }

      console.warn(`Ignoring unknown argument: ${arg}`);
    }

    try {
      const campaign = await currentCampaignForLogging();
      const { file } = await resolveLogFile(campaign);
      const contents = await fs.readFile(file, 'utf-8').catch((error: unknown) => {
        const maybeErrno = error as NodeJS.ErrnoException;
        if (maybeErrno?.code === 'ENOENT') {
          return '';
        }
        throw error;
      });

      const trimmed = contents.trim();
      if (trimmed.length === 0) {
        process.exit(0);
      }

      const lines = trimmed.split(/\r?\n/);
      const tail = lines.slice(-count);
      tail.forEach((line) => console.log(line));
      process.exit(0);
    } catch (error) {
      if (error instanceof Error) {
        console.error(error.message);
      } else {
        console.error('Failed to read session log.');
      }
      process.exit(1);
    }
    return;
  }

  console.error(`Unknown session subcommand: ${subcommand}`);
  process.exit(1);
}

function handleEncounterRestCommand(rawArgs: string[]): void {
  if (rawArgs.length === 0) {
    console.error('Usage: pnpm dev -- encounter rest <long|short> [options]');
    process.exit(1);
  }

  const [restTypeRaw, ...optionArgs] = rawArgs;
  const restType = restTypeRaw?.toLowerCase();

  let who = 'party';
  let hitDice = 0;
  const unknownArgs: string[] = [];

  const parseValue = (label: string, value: string | undefined): string => {
    if (value === undefined) {
      console.error(`Expected value after ${label}.`);
      process.exit(1);
    }
    return value;
  };

  const parseHitDice = (label: string, value: string | undefined): number => {
    const parsed = Number.parseInt(parseValue(label, value).trim(), 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      console.error('--hd must be a non-negative integer.');
      process.exit(1);
    }
    return parsed;
  };

  for (let i = 0; i < optionArgs.length; i += 1) {
    const arg = optionArgs[i];
    if (!arg) {
      continue;
    }

    const lower = arg.toLowerCase();
    if (lower.startsWith('--who=')) {
      who = arg.slice('--who='.length).trim();
      continue;
    }
    if (lower === '--who') {
      who = parseValue('--who', optionArgs[i + 1]).trim();
      i += 1;
      continue;
    }
    if (lower.startsWith('--hd=')) {
      hitDice = parseHitDice('--hd', arg.slice('--hd='.length));
      continue;
    }
    if (lower === '--hd') {
      hitDice = parseHitDice('--hd', optionArgs[i + 1]);
      i += 1;
      continue;
    }

    unknownArgs.push(arg);
  }

  if (unknownArgs.length > 0) {
    console.warn(`Ignoring extra argument(s): ${unknownArgs.join(', ')}`);
  }

  const encounter = requireEncounterState();

  try {
    if (restType === 'long') {
      const result = encounterLongRest(encounter, { who });
      saveEncounter(result.state);
      result.lines.forEach((line) => console.log(line));
      process.exit(0);
    }

    if (restType === 'short') {
      const result = encounterShortRest(encounter, { who, hitDice });
      saveEncounter(result.state);
      result.lines.forEach((line) => console.log(line));
      process.exit(0);
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(String(error));
    }
    process.exit(1);
  }

  console.error(`Unknown rest type: ${restTypeRaw}`);
  process.exit(1);
}

async function handleCampaignCommand(rawArgs: string[]): Promise<void> {
  if (rawArgs.length === 0) {
    console.error('Missing campaign subcommand.');
    process.exit(1);
  }

  const [subcommand, ...rest] = rawArgs;

  if (subcommand === 'new') {
    const force = rest.includes('--force');
    const name = rest.filter((part) => part !== '--force').join(' ').trim();
    if (!name) {
      console.error('Campaign name is required.');
      process.exit(1);
    }

    try {
      const { slug, created, overwritten } = await createCampaign(name, { force });
      if (!created) {
        console.log(`Campaign "${slug}" already exists.`);
      } else if (overwritten) {
        console.log(`Campaign overwritten: ${slug}`);
      } else {
        console.log(`Campaign created: ${slug}`);
      }
      process.exit(0);
    } catch (error) {
      if (error instanceof Error) {
        console.error(error.message);
      } else {
        console.error('Failed to create campaign.');
      }
      process.exit(1);
    }
    return;
  }

  if (subcommand === 'open') {
    const name = rest.join(' ').trim();
    if (!name) {
      console.error('Campaign name is required to open.');
      process.exit(1);
    }

    try {
      const { campaign } = await loadCampaignByName(name);
      console.log(`Campaign opened: ${campaign.name} — party: ${formatCampaignParty(campaign.party)}`);

      if (campaign.currentSnapshot) {
        const absoluteSnapshot = resolveSnapshotAbsolutePath(campaign.currentSnapshot);
        const snapshotName = basename(absoluteSnapshot).replace(/\.json$/i, '');
        const encounter = loadEncounterByName(snapshotName);
        if (encounter) {
          saveEncounter(encounter);
          console.log('Encounter restored from snapshot.');
        } else {
          console.warn('Snapshot not found; encounter not restored.');
        }
      }

      process.exit(0);
    } catch (error) {
      const maybeErrno = error as NodeJS.ErrnoException;
      if (maybeErrno?.code === 'ENOENT') {
        console.error(`Campaign not found: ${name}`);
      } else if (error instanceof Error) {
        console.error(error.message);
      } else {
        console.error('Failed to open campaign.');
      }
      process.exit(1);
    }
    return;
  }

  if (subcommand === 'save') {
    const encounter = loadEncounter();
    if (!encounter) {
      console.log('No active encounter');
      process.exit(0);
    }

    const filePath = saveEncounterAs('autosave', encounter);
    const snapshotRelative = relativeSnapshotPath(filePath);
    const campaignFile = await guessCurrentCampaignFile();
    if (!campaignFile) {
      console.log('No campaign open; snapshot written only.');
      console.log(`Snapshot path: ${snapshotRelative}`);
      process.exit(0);
    }

    try {
      const campaign = await readCampaignFile(campaignFile);
      campaign.currentSnapshot = snapshotRelative;
      await writeCampaignFile(campaignFile, campaign);
      console.log(`Campaign saved. Snapshot → ${snapshotRelative}`);
      process.exit(0);
    } catch (error) {
      const maybeErrno = error as NodeJS.ErrnoException;
      if (maybeErrno?.code === 'ENOENT') {
        console.error('Campaign file not found.');
      } else if (error instanceof Error) {
        console.error(error.message);
      } else {
        console.error('Failed to update campaign with snapshot.');
      }
      process.exit(1);
    }
    return;
  }

  if (subcommand === 'note') {
    const text = rest.join(' ').trim();
    if (!text) {
      console.error('Note text is required.');
      process.exit(1);
    }

    const campaignFile = await guessCurrentCampaignFile();
    if (!campaignFile) {
      console.error('No campaign open');
      process.exit(1);
    }

    try {
      const campaign = await readCampaignFile(campaignFile);
      await appendCampaignNote(campaign, text);
      console.log('Note appended.');
      process.exit(0);
    } catch (error) {
      const maybeErrno = error as NodeJS.ErrnoException;
      if (maybeErrno?.code === 'ENOENT') {
        console.error('Campaign file not found.');
      } else if (error instanceof Error) {
        console.error(error.message);
      } else {
        console.error('Failed to append note.');
      }
      process.exit(1);
    }
    return;
  }

  if (subcommand === 'party') {
    if (rest.length === 0) {
      console.error('Missing party subcommand.');
      process.exit(1);
    }

    const [partyAction, ...nameParts] = rest;
    const memberName = nameParts.join(' ').trim();

    if ((partyAction === 'add' || partyAction === 'remove') && !memberName) {
      console.error('Party member name is required.');
      process.exit(1);
    }

    const campaignFile = await guessCurrentCampaignFile();
    if (!campaignFile) {
      console.error('No campaign open');
      process.exit(1);
    }

    try {
      const campaign = await readCampaignFile(campaignFile);

      if (partyAction === 'add') {
        if (!campaign.party.includes(memberName)) {
          campaign.party = [...campaign.party, memberName];
          await writeCampaignFile(campaignFile, campaign);
        }
        console.log(`Party updated: ${formatCampaignParty(campaign.party)}`);
        process.exit(0);
        return;
      }

      if (partyAction === 'remove') {
        const nextParty = campaign.party.filter((member) => member !== memberName);
        if (nextParty.length !== campaign.party.length) {
          campaign.party = nextParty;
          await writeCampaignFile(campaignFile, campaign);
        }
        console.log(`Party updated: ${formatCampaignParty(campaign.party)}`);
        process.exit(0);
        return;
      }

      console.error(`Unknown party subcommand: ${partyAction}`);
      process.exit(1);
      return;
    } catch (error) {
      const maybeErrno = error as NodeJS.ErrnoException;
      if (maybeErrno?.code === 'ENOENT') {
        console.error('Campaign file not found.');
      } else if (error instanceof Error) {
        console.error(error.message);
      } else {
        console.error('Failed to update party.');
      }
      process.exit(1);
    }
    return;
  }

  if (subcommand === 'status') {
    const campaignFile = await guessCurrentCampaignFile();
    if (!campaignFile) {
      console.log('No campaign open.');
      process.exit(0);
    }

    try {
      const campaign = await readCampaignFile(campaignFile);
      const summary = {
        file: relative(process.cwd(), campaignFile),
        name: campaign.name,
        party: campaign.party,
        currentSnapshot: snapshotLabel(campaign.currentSnapshot),
        notesFile: relativeSnapshotPath(campaign.notesFile),
      };
      console.log(JSON.stringify(summary, null, 2));
      process.exit(0);
    } catch (error) {
      const maybeErrno = error as NodeJS.ErrnoException;
      if (maybeErrno?.code === 'ENOENT') {
        console.error('Campaign file not found.');
      } else if (error instanceof Error) {
        console.error(error.message);
      } else {
        console.error('Failed to read campaign status.');
      }
      process.exit(1);
    }
    return;
  }

  console.error(`Unknown campaign subcommand: ${subcommand}`);
  process.exit(1);
}

async function handleEncounterCommand(rawArgs: string[]): Promise<void> {
  if (rawArgs.length === 0) {
    console.error('Missing encounter subcommand.');
    showUsage();
    process.exit(1);
  }

  const [subcommand, ...rest] = rawArgs;

  if (subcommand === 'start') {
    await handleEncounterStartCommand(rest);
    return;
  }

  if (subcommand === 'add') {
    await handleEncounterAddCommand(rest);
    return;
  }

  if (subcommand === 'build') {
    await handleEncounterBuildCommand(rest);
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

  if (subcommand === 'ls') {
    handleEncounterListSnapshotsCommand();
    return;
  }

  if (subcommand === 'list-saves') {
    handleEncounterListSnapshotsCommand();
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

  if (subcommand === 'rest') {
    handleEncounterRestCommand(rest);
    return;
  }

  if (subcommand === 'damage') {
    await handleEncounterDamageCommand(rest);
    return;
  }

  if (subcommand === 'heal') {
    await handleEncounterHealCommand(rest);
    return;
  }

  if (subcommand === 'init') {
    handleEncounterInitCommand(rest);
    return;
  }

  if (subcommand === 'next') {
    await handleEncounterNextCommand();
    return;
  }

  if (subcommand === 'prev') {
    await handleEncounterPrevCommand();
    return;
  }

  if (subcommand === 'check') {
    handleEncounterCheckCommand(rest);
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

  if (subcommand === 'bless') {
    await handleEncounterBlessCommand(rest);
    return;
  }

  if (subcommand === 'guidance') {
    await handleEncounterGuidanceCommand(rest);
    return;
  }

  if (subcommand === 'inspire') {
    if (rest[0] && rest[0].toLowerCase() === 'use') {
      handleEncounterInspireUseCommand(rest.slice(1));
    } else {
      await handleEncounterInspireCommand(rest);
    }
    return;
  }

  if (subcommand === 'inspire-clear') {
    handleEncounterInspireClearCommand(rest);
    return;
  }

  if (subcommand === 'mark') {
    await handleEncounterMarkCommand(rest);
    return;
  }

  if (subcommand === 'clear') {
    handleEncounterClearCommand(rest);
    return;
  }

  if (subcommand === 'remind') {
    handleEncounterRemindCommand(rest);
    return;
  }

  if (subcommand === 'adv' || subcommand === 'advantage') {
    handleEncounterAdvantageToggleCommand(rest, 'advantage');
    return;
  }

  if (subcommand === 'dis' || subcommand === 'disadvantage') {
    handleEncounterAdvantageToggleCommand(rest, 'disadvantage');
    return;
  }

  if (subcommand === 'prone') {
    handleEncounterConditionTagCommand(rest, 'prone');
    return;
  }

  if (subcommand === 'restrained') {
    handleEncounterConditionTagCommand(rest, 'restrained');
    return;
  }

  if (subcommand === 'invisible') {
    handleEncounterConditionTagCommand(rest, 'invisible');
    return;
  }

  if (subcommand === 'concentration') {
    handleEncounterConcentrationCommand(rest);
    return;
  }

  if (subcommand === 'condition') {
    handleEncounterConditionCommand(rest);
    return;
  }

  if (subcommand === 'note') {
    handleEncounterNoteCommand(rest);
    return;
  }

  if (subcommand === 'attack') {
    if (rest.length === 2) {
      const encounter = loadEncounter();
      if (encounter) {
        try {
          const attackerId = getActorIdByName(encounter, rest[0]!);
          const defenderId = getActorIdByName(encounter, rest[1]!);
          await handleEncounterAttackCommand([attackerId, defenderId]);
          return;
        } catch (error) {
          const attackerIsId = Boolean(encounter.actors[rest[0]!]);
          const defenderIsId = Boolean(encounter.actors[rest[1]!]);
          if (!attackerIsId || !defenderIsId) {
            if (error instanceof Error) {
              console.error(error.message);
            } else {
              console.error(String(error));
            }
            process.exit(1);
          }
        }
      }
    }

    await handleEncounterAttackCommand(rest);
    return;
  }

  if (subcommand === 'end') {
    await handleEncounterEndCommand();
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

async function handleCompendiumCommand(rawArgs: string[]): Promise<void> {
  if (rawArgs.length === 0) {
    console.error('Usage: pnpm dev -- compendium <seed|import|stats> ...');
    process.exit(1);
  }

  const [subcommand, ...rest] = rawArgs;

  if (subcommand === 'seed') {
    const target = rest.join(' ').trim();
    if (target !== 'srd-basic') {
      console.error('Usage: pnpm dev -- compendium seed srd-basic');
      process.exit(1);
    }
    const count = await seedCompendiumBasic();
    console.log(`Compendium seeded. Monsters: ${count}.`);
    process.exit(0);
  }

  if (subcommand === 'import') {
    const target = rest[0];
    if (!target) {
      console.error('Compendium import path is required.');
      process.exit(1);
    }
    try {
      const result = await importCompendiumMonsters(target);
      if (!result.ok) {
        console.log(result.message);
        process.exit(0);
      }
      console.log(`Compendium monsters: ${result.count} entries.`);
      process.exit(0);
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Failed to import monsters: ${error.message}`);
      } else {
        console.error('Failed to import monsters.');
      }
      process.exit(1);
    }
  }

  if (subcommand === 'stats') {
    const query = rest.join(' ').trim();
    if (!query) {
      console.error('Compendium stats query is required.');
      process.exit(1);
    }

    const index = await readCompendiumIndex();
    const template = resolveCompendiumTemplate(index, query);
    if (!template) {
      console.log(`Not found: ${query}`);
      process.exit(0);
    }

    const summary = summarizeTemplate(template);
    const acLabel = Number.isFinite(summary.ac) ? summary.ac : '?';
    const hpLabel = Number.isFinite(summary.hp) ? summary.hp : '?';
    console.log(`${summary.name} — AC ${acLabel} — HP ${hpLabel}`);
    process.exit(0);
  }

  console.error(`Unknown compendium subcommand: ${subcommand}`);
  process.exit(1);
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
    await handleCharacterCommand(rest);
    return;
  }

  if (command === 'campaign') {
    await handleCampaignCommand(rest);
    return;
  }

  if (command === 'death') {
    await handleDeathCommand(rest);
    return;
  }

  if (command === 'stabilize') {
    await handleStabilizeCommand(rest);
    return;
  }

  if (command === 'encounter') {
    await handleEncounterCommand(rest);
    return;
  }

  if (command === 'session') {
    await handleSessionCommand(rest);
    return;
  }

  if (command === 'inventory') {
    await handleInventoryCommand(rest);
    return;
  }

  if (command === 'loot') {
    await handleLootCommand(rest);
    return;
  }

  if (command === 'settings') {
    await handleSettingsCommand(rest);
    return;
  }

  if (command === 'compendium') {
    await handleCompendiumCommand(rest);
    return;
  }

  if (command === 'spell') {
    await handleSpellCommand(rest);
    return;
  }

  if (command === 'monster') {
    await handleMonsterCommand(rest);
    return;
  }

  if (command === 'hm' || command === 'hunters-mark') {
    await handleHuntersMarkCommand(rest);
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
