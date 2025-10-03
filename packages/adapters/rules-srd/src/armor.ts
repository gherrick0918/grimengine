export type ArmorCategory = 'unarmored' | 'light' | 'medium' | 'heavy' | 'shield';

export interface Armor {
  name: string;
  category: Exclude<ArmorCategory, 'shield'>;
  baseAC: number;
  dexCap?: number;
}

export interface Shield {
  name: string;
  bonusAC: number;
}

export const ARMORS: Armor[] = [
  { name: 'Padded', category: 'light', baseAC: 11 },
  { name: 'Leather', category: 'light', baseAC: 11 },
  { name: 'Studded Leather', category: 'light', baseAC: 12 },
  { name: 'Hide', category: 'medium', baseAC: 12, dexCap: 2 },
  { name: 'Chain Shirt', category: 'medium', baseAC: 13, dexCap: 2 },
  { name: 'Scale Mail', category: 'medium', baseAC: 14, dexCap: 2 },
  { name: 'Breastplate', category: 'medium', baseAC: 14, dexCap: 2 },
  { name: 'Half Plate', category: 'medium', baseAC: 15, dexCap: 2 },
  { name: 'Ring Mail', category: 'heavy', baseAC: 14, dexCap: 0 },
  { name: 'Chain Mail', category: 'heavy', baseAC: 16, dexCap: 0 },
  { name: 'Splint', category: 'heavy', baseAC: 17, dexCap: 0 },
  { name: 'Plate', category: 'heavy', baseAC: 18, dexCap: 0 },
];

export const SHIELD: Shield = { name: 'Shield', bonusAC: 2 };

export function getArmorByName(name: string): Armor | undefined {
  return ARMORS.find((armor) => armor.name.toLowerCase() === name.toLowerCase());
}
