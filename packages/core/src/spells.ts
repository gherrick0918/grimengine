import type { NormalizedSpell } from '@grimengine/dnd5e-api/spells.js';
import { abilityMod, proficiencyBonusForLevel, type Character } from './character.js';
import { attackRoll, damageRoll } from './combat.js';

export interface CastOptions {
  caster: Character;
  spell: NormalizedSpell;
  castingAbility?: 'INT' | 'WIS' | 'CHA';
  targetAC?: number;
  slotLevel?: number;
  seed?: string;
}

function formatDamageExpression(dice: string, modifier: number): string {
  if (modifier === 0) {
    return dice;
  }
  return modifier > 0 ? `${dice}+${modifier}` : `${dice}${modifier}`;
}

export function diceForCharacterLevel(spell: NormalizedSpell, characterLevel: number): string | undefined {
  const table = spell.damageAtCharacterLevel;
  if (!table) {
    return spell.damageDice;
  }

  const entries = Object.entries(table)
    .map(([key, value]) => {
      const level = Number.parseInt(key, 10);
      return Number.isFinite(level) ? ({ level, dice: value } as const) : undefined;
    })
    .filter((entry): entry is { level: number; dice: string } => Boolean(entry))
    .sort((a, b) => a.level - b.level);

  let candidate: string | undefined;
  for (const entry of entries) {
    if (characterLevel >= entry.level) {
      candidate = entry.dice;
    } else {
      break;
    }
  }

  return candidate ?? spell.damageDice;
}

export function diceForSlotLevel(spell: NormalizedSpell, slotLevel?: number): string | undefined {
  if (!slotLevel || slotLevel < 1) {
    return spell.damageDice;
  }
  const table = spell.damageAtSlotLevel;
  if (!table) {
    return spell.damageDice;
  }

  const value = table[slotLevel];
  return value ?? spell.damageDice;
}

export interface CastResult {
  kind: 'save' | 'attack' | 'none';
  attack?: {
    rolls: number[];
    natural: number;
    total: number;
    hit: boolean;
    isCrit: boolean;
    isFumble: boolean;
    expression: string;
  };
  save?: {
    ability: 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';
    dc: number;
    success?: boolean;
  };
  damage?: {
    base: number;
    final: number;
    expression: string;
  };
  notes?: string[];
}

export function spellSaveDC(caster: Character, ability: 'INT' | 'WIS' | 'CHA'): number {
  const pb = proficiencyBonusForLevel(caster.level);
  return 8 + pb + abilityMod(caster.abilities[ability]);
}

export function chooseCastingAbility(
  caster: Character,
  spell: NormalizedSpell,
  override?: 'INT' | 'WIS' | 'CHA',
): 'INT' | 'WIS' | 'CHA' {
  if (override) {
    return override;
  }
  if (spell.dcAbility) {
    return spell.dcAbility;
  }
  const picks: Array<{ ability: 'INT' | 'WIS' | 'CHA'; mod: number }> = ['INT', 'WIS', 'CHA'].map((ability) => ({
    ability,
    mod: abilityMod(caster.abilities[ability]),
  }));
  picks.sort((a, b) => b.mod - a.mod);
  return picks[0]?.ability ?? 'CHA';
}

export function castSpell(opts: CastOptions): CastResult {
  const { caster } = opts;
  const spell = opts.spell;
  const ability = chooseCastingAbility(caster, spell, opts.castingAbility);
  const pb = proficiencyBonusForLevel(caster.level);
  const abilityModifier = abilityMod(caster.abilities[ability]);
  const notes: string[] = [];
  const attackSeed = opts.seed ? `${opts.seed}:attack` : undefined;
  const damageSeed = opts.seed ? `${opts.seed}:damage` : undefined;

  const damageExpression = (() => {
    const baseDice = (() => {
      if (spell.level === 0) {
        return diceForCharacterLevel(spell, caster.level);
      }
      if (typeof opts.slotLevel === 'number' && spell.damageAtSlotLevel) {
        return diceForSlotLevel(spell, opts.slotLevel);
      }
      return spell.damageDice;
    })();

    if (!baseDice) {
      return undefined;
    }
    return formatDamageExpression(baseDice, abilityModifier);
  })();

  if (spell.attackType) {
    if (typeof opts.targetAC !== 'number') {
      notes.push('Spell attack requires a target AC.');
      return { kind: 'attack', notes };
    }

    const attackResult = attackRoll({
      abilityMod: abilityModifier + pb,
      advantage: false,
      disadvantage: false,
      targetAC: opts.targetAC,
      seed: attackSeed,
    });

    let damage;
    if (attackResult.hit && damageExpression) {
      const rollResult = damageRoll({ expression: damageExpression, seed: damageSeed });
      damage = {
        base: rollResult.baseTotal,
        final: rollResult.finalTotal,
        expression: rollResult.expression,
      };
    }

    const hit = attackResult.hit === true || attackResult.isCrit;

    return {
      kind: 'attack',
      attack: {
        rolls: attackResult.d20s,
        natural: attackResult.natural,
        total: attackResult.total,
        hit,
        isCrit: attackResult.isCrit,
        isFumble: attackResult.isFumble,
        expression: attackResult.expression,
      },
      damage,
      notes: notes.length > 0 ? notes : undefined,
    };
  }

  if (spell.save) {
    const dc = spellSaveDC(caster, ability);
    let damage;
    if (damageExpression) {
      const rollResult = damageRoll({ expression: damageExpression, seed: damageSeed });
      damage = {
        base: rollResult.baseTotal,
        final: rollResult.finalTotal,
        expression: rollResult.expression,
      };
    }

    return {
      kind: 'save',
      save: {
        ability: spell.save.ability,
        dc,
      },
      damage,
      notes: notes.length > 0 ? notes : undefined,
    };
  }

  notes.push('No attack or save mechanics found for this spell.');
  return { kind: 'none', notes };
}

export type { NormalizedSpell };
