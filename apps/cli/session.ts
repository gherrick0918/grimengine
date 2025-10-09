import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeCharacter, type Character } from '@grimengine/core';

const DIR = join(process.cwd(), '.data', 'session');
const FILE = join(DIR, 'character.json');

export function saveCharacter(character: Character): void {
  mkdirSync(DIR, { recursive: true });
  const normalized = normalizeCharacter(character);
  writeFileSync(FILE, JSON.stringify(normalized, null, 2), 'utf-8');
}

export function loadCharacter(): Character | null {
  if (!existsSync(FILE)) {
    return null;
  }

  try {
    const raw = readFileSync(FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Character;
    return normalizeCharacter(parsed);
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
