import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Character } from '@grimengine/core';

const ROOT = join(process.cwd(), '.data', 'characters');

export function ensureVault(): void {
  mkdirSync(ROOT, { recursive: true });
}

export function characterPath(name: string): string {
  return join(ROOT, `${name}.json`);
}

export function saveToVault(name: string, character: Character): void {
  ensureVault();
  writeFileSync(characterPath(name), JSON.stringify(character, null, 2), 'utf-8');
}

export function loadFromVault(name: string): Character | null {
  try {
    const path = characterPath(name);
    if (!existsSync(path)) {
      return null;
    }
    const raw = readFileSync(path, 'utf-8');
    return JSON.parse(raw) as Character;
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
