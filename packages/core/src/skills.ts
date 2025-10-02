import type { AbilityName } from './abilityScores.js';
import type { SkillName } from './character.js';

export const SKILL_ABILITY: Record<SkillName, AbilityName> = {
  Acrobatics: 'DEX',
  'Animal Handling': 'WIS',
  Arcana: 'INT',
  Athletics: 'STR',
  Deception: 'CHA',
  History: 'INT',
  Insight: 'WIS',
  Intimidation: 'CHA',
  Investigation: 'INT',
  Medicine: 'WIS',
  Nature: 'INT',
  Perception: 'WIS',
  Performance: 'CHA',
  Persuasion: 'CHA',
  Religion: 'INT',
  'Sleight of Hand': 'DEX',
  Stealth: 'DEX',
  Survival: 'WIS',
};
