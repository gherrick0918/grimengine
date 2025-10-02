import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Character } from '@grimengine/core';

const DIR = join(process.cwd(), '.data', 'session');
const FILE = join(DIR, 'character.json');

export function saveCharacter(character: Character): void {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify(character, null, 2), 'utf-8');
}

export function loadCharacter(): Character | null {
  if (!existsSync(FILE)) {
    return null;
  }

  try {
    const raw = readFileSync(FILE, 'utf-8');
    return JSON.parse(raw) as Character;
  } catch {
    return null;
  }
}

export function clearCharacter(): void {
  try {
    if (existsSync(FILE)) {
      rmSync(FILE);
    }
  } catch {
    // ignore
  }
}
