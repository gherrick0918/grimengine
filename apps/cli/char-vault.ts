import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeCharacter, type Character } from '@grimengine/core';

const ROOT = join(process.cwd(), '.data', 'characters');

export function ensureVault(): void {
  mkdirSync(ROOT, { recursive: true });
}

export function characterPath(name: string): string {
  return join(ROOT, `${name}.json`);
}

export function saveToVault(name: string, character: Character): void {
  ensureVault();
  const normalized = normalizeCharacter(character);
  writeFileSync(characterPath(name), JSON.stringify(normalized, null, 2), 'utf-8');
}

export function loadFromVault(name: string): Character | null {
  try {
    const path = characterPath(name);
    if (!existsSync(path)) {
      return null;
    }
    const raw = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(raw) as Character;
    return normalizeCharacter(parsed);
  } catch {
    return null;
  }
}

export function listVaultNames(): string[] {
  ensureVault();
  return readdirSync(ROOT)
    .filter((file) => file.toLowerCase().endsWith('.json'))
    .map((file) => file.replace(/\.json$/i, ''))
    .sort((a, b) => a.localeCompare(b));
}
