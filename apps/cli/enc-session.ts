import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { EncounterState } from '@grimengine/core';

interface StoredEncounter extends Omit<EncounterState, 'defeated'> {
  defeated: string[];
}

const ROOT = join(process.cwd(), '.data', 'encounters');
const SAVES = join(ROOT, 'saves');
const CURRENT = join(ROOT, 'current.json');

function ensureDirs(): void {
  mkdirSync(ROOT, { recursive: true });
  mkdirSync(SAVES, { recursive: true });
}

function serialize(state: EncounterState): StoredEncounter {
  return {
    ...state,
    defeated: [...state.defeated],
  };
}

function deserialize(raw: StoredEncounter): EncounterState {
  return {
    ...raw,
    defeated: new Set(raw.defeated),
  };
}

export function readCurrentEncounter(): EncounterState | null {
  if (!existsSync(CURRENT)) {
    return null;
  }

  try {
    const contents = readFileSync(CURRENT, 'utf-8');
    const parsed = JSON.parse(contents) as StoredEncounter;
    return deserialize(parsed);
  } catch {
    return null;
  }
}

export function writeCurrentEncounter(state: EncounterState): void {
  ensureDirs();
  writeFileSync(CURRENT, JSON.stringify(serialize(state), null, 2), 'utf-8');
}

export function clearCurrentEncounter(): void {
  try {
    if (existsSync(CURRENT)) {
      rmSync(CURRENT);
    }
  } catch {
    // ignore errors when clearing encounters
  }
}

export function saveEncounterAs(name: string, state: EncounterState): string {
  ensureDirs();
  const filePath = join(SAVES, `${name}.json`);
  writeFileSync(filePath, JSON.stringify(serialize(state), null, 2), 'utf-8');
  return filePath;
}

export function loadEncounterByName(name: string): EncounterState | null {
  const filePath = join(SAVES, `${name}.json`);
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const contents = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(contents) as StoredEncounter;
    return deserialize(parsed);
  } catch {
    return null;
  }
}

export function deleteEncounterByName(name: string): boolean {
  const filePath = join(SAVES, `${name}.json`);
  if (!existsSync(filePath)) {
    return false;
  }

  try {
    rmSync(filePath);
    return true;
  } catch {
    return false;
  }
}

export function listEncounterSaves(): string[] {
  ensureDirs();
  return readdirSync(SAVES)
    .filter((file) => file.toLowerCase().endsWith('.json'))
    .map((file) => file.replace(/\.json$/i, ''));
}

export function saveEncounter(state: EncounterState): void {
  writeCurrentEncounter(state);
}

export function loadEncounter(): EncounterState | null {
  return readCurrentEncounter();
}

export function clearEncounter(): void {
  clearCurrentEncounter();
}
