import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

import { normalizeMonster } from '../../adapters/dnd5e-api/src/monsters.js';

const fixturePath = fileURLToPath(new URL('./fixtures/goblin.api.json', import.meta.url));
const goblinApi = JSON.parse(readFileSync(fixturePath, 'utf8'));

describe('normalizeMonster', () => {
  test('maps basic stats and attack profile from 5eAPI data', () => {
    const monster = normalizeMonster('Goblin', goblinApi);

    expect(monster.name).toBe('Goblin');
    expect(monster.ac).toBe(15);
    expect(monster.hp).toBe(7);
    expect(monster.maxHp).toBe(7);
    expect(monster.abilityMods.STR).toBe(-1);
    expect(monster.abilityMods.DEX).toBe(2);
    expect(monster.proficiencyBonus).toBe(2);

    expect(monster.attacks).toHaveLength(1);
    const [attack] = monster.attacks;
    expect(attack.name).toBe('Scimitar');
    expect(attack.attackMod).toBe(4);
    expect(attack.damageExpr).toBe('1d6+2');
  });
});
