import { describe, expect, it } from 'vitest';

import {
  characterSkillCheck,
  passivePerception,
  skillAbility,
  type Character,
} from '../src/character.js';

function buildCharacter(proficiencies: Character['proficiencies'] = {}): Character {
  return {
    name: 'Tester',
    level: 5,
    abilities: {
      STR: 10,
      DEX: 10,
      CON: 10,
      INT: 10,
      WIS: 14,
      CHA: 10,
    },
    proficiencies,
  };
}

describe('skillAbility', () => {
  it('maps skills to their governing abilities', () => {
    expect(skillAbility('Athletics')).toBe('STR');
    expect(skillAbility('Stealth')).toBe('DEX');
    expect(skillAbility('Perception')).toBe('WIS');
  });
});

describe('characterSkillCheck', () => {
  it('applies proficiency and expertise modifiers', () => {
    const base = buildCharacter();
    const proficient = buildCharacter({ skills: ['Perception'] });
    const expert = buildCharacter({ skills: ['Perception'], expertise: ['Perception'] });

    const seed = 'skill-check';

    const baseResult = characterSkillCheck(base, 'Perception', { seed });
    const profResult = characterSkillCheck(proficient, 'Perception', { seed });
    const expertResult = characterSkillCheck(expert, 'Perception', { seed });

    expect(profResult.rolls).toEqual(baseResult.rolls);
    expect(expertResult.rolls).toEqual(baseResult.rolls);

    expect(profResult.total - baseResult.total).toBe(3);
    expect(expertResult.total - baseResult.total).toBe(6);
  });

  it('is deterministic when provided a seed', () => {
    const character = buildCharacter({ skills: ['Stealth'] });
    const first = characterSkillCheck(character, 'Stealth', { seed: 'deterministic' });
    const second = characterSkillCheck(character, 'Stealth', { seed: 'deterministic' });

    expect(second).toEqual(first);
  });
});

describe('passivePerception', () => {
  it('computes passive perception from ability and proficiency', () => {
    const base = buildCharacter();
    const proficient = buildCharacter({ skills: ['Perception'] });
    const expert = buildCharacter({ skills: ['Perception'], expertise: ['Perception'] });

    expect(passivePerception(base)).toBe(12);
    expect(passivePerception(proficient)).toBe(15);
    expect(passivePerception(expert)).toBe(18);
  });
});
