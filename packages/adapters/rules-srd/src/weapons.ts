import type { Weapon } from '@grimengine/core/src/weapons.js';

export const WEAPONS: Weapon[] = [
  {
    name: 'Dagger',
    category: 'simple',
    type: 'melee',
    damage: { expression: '1d4+0', type: 'piercing' },
    properties: { finesse: true, light: true, thrown: { normal: 20, long: 60 } },
  },
  {
    name: 'Mace',
    category: 'simple',
    type: 'melee',
    damage: { expression: '1d6+0', type: 'bludgeoning' },
  },
  {
    name: 'Handaxe',
    category: 'simple',
    type: 'melee',
    damage: { expression: '1d6+0', type: 'slashing' },
    properties: { thrown: { normal: 20, long: 60 }, light: true },
  },
  {
    name: 'Rapier',
    category: 'martial',
    type: 'melee',
    damage: { expression: '1d8+0', type: 'piercing' },
    properties: { finesse: true },
  },
  {
    name: 'Longsword',
    category: 'martial',
    type: 'melee',
    damage: { expression: '1d8+0', type: 'slashing' },
    versatile: { expression: '1d10+0' },
  },
  {
    name: 'Greatsword',
    category: 'martial',
    type: 'melee',
    damage: { expression: '2d6+0', type: 'slashing' },
    properties: { heavy: true, twoHanded: true },
  },
  {
    name: 'Longbow',
    category: 'martial',
    type: 'ranged',
    damage: { expression: '1d8+0', type: 'piercing' },
    properties: { ammunition: true, heavy: true, twoHanded: true },
    range: { normal: 150, long: 600 },
  },
];
