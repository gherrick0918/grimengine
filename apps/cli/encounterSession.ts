import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { EncounterState } from '@grimengine/core';

interface StoredEncounter extends Omit<EncounterState, 'defeated'> {
  defeated: string[];
}

const DIR = join(process.cwd(), '.data', 'encounters');
const FILE = join(DIR, 'current.json');

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

export function saveEncounter(state: EncounterState): void {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify(serialize(state), null, 2), 'utf-8');
}

export function loadEncounter(): EncounterState | null {
  if (!existsSync(FILE)) {
    return null;
  }

  try {
    const contents = readFileSync(FILE, 'utf-8');
    const parsed = JSON.parse(contents) as StoredEncounter;
    return deserialize(parsed);
  } catch {
    return null;
  }
}

export function clearEncounter(): void {
  try {
    if (existsSync(FILE)) {
      rmSync(FILE);
    }
  } catch {
    // ignore errors when clearing encounters
  }
}
