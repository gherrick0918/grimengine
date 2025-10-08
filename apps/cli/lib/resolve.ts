import type { EncounterState, Actor } from '@grimengine/core';

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

function baseName(value: string): string {
  return value.replace(/\s+#\d+$/, '').trim();
}

function findByName(actors: Actor[], needle: string): Actor | undefined {
  return actors.find((actor) => normalize(actor.name) === needle);
}

function findByBaseName(actors: Actor[], needle: string): Actor[] {
  const target = baseName(needle);
  return actors.filter((actor) => normalize(baseName(actor.name)) === normalize(target));
}

export function getActorIdByName(encounter: EncounterState, name: string): string {
  const needle = normalize(name);
  if (!needle) {
    throw new Error('Actor name is required.');
  }

  const actors = Object.values(encounter.actors);
  const exact = findByName(actors, needle);
  if (exact) {
    return exact.id;
  }

  const candidates = findByBaseName(actors, needle);
  if (candidates.length === 1) {
    return candidates[0]!.id;
  }

  if (candidates.length > 1) {
    throw new Error(`Multiple actors match "${name}". Try "${candidates[0]!.name}" etc.`);
  }

  throw new Error(`Actor not found: ${name}`);
}
