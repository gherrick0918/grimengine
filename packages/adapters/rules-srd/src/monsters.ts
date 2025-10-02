import type { MonsterActor } from '@grimengine/core';

export const MONSTERS: Omit<MonsterActor, 'id' | 'side'>[] = [
  {
    type: 'monster',
    name: 'Goblin',
    ac: 15,
    hp: 7,
    maxHp: 7,
    abilityMods: { DEX: 2, STR: -1 },
    proficiencyBonus: 2,
    attacks: [
      { name: 'Scimitar', attackMod: 4, damageExpr: '1d6+2' },
      { name: 'Shortbow', attackMod: 4, damageExpr: '1d6+2' },
    ],
  },
  {
    type: 'monster',
    name: 'Bandit',
    ac: 12,
    hp: 11,
    maxHp: 11,
    abilityMods: { DEX: 1, STR: 1 },
    proficiencyBonus: 2,
    attacks: [
      { name: 'Scimitar', attackMod: 3, damageExpr: '1d6+1' },
      { name: 'Light Crossbow', attackMod: 3, damageExpr: '1d8+1' },
    ],
  },
];

export function getMonsterByName(name: string) {
  return MONSTERS.find((monster) => monster.name.toLowerCase() === name.toLowerCase());
}
