import { WEAPONS } from './weapons.js';
import { ARMORS } from './armor.js';

/** Return a simple item name for loot. */
export function randomSimpleItem(seed?: string): string {
  const pick = (arr: string[], idx: number) => arr[idx % arr.length];
  const weapons = WEAPONS.map((weapon) => weapon.name);
  const armors = ARMORS.map((armor) => armor.name);

  const bias =
    seed && seed.length > 0
      ? seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 10
      : 0;
  if (bias < 7) {
    return pick(weapons, bias);
  }
  return pick(armors, bias - 7);
}
