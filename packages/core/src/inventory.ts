import type { EncounterState } from './encounter.js';

export type InventoryItem = {
  name: string;
  qty: number;
};

type InventoryEncounter = EncounterState & {
  partyBag?: InventoryItem[];
  inventories?: Record<string, InventoryItem[]>;
};

function ensurePartyBag(encounter: InventoryEncounter): InventoryItem[] {
  if (!encounter.partyBag) {
    encounter.partyBag = [];
  }
  return encounter.partyBag;
}

function ensureInventories(encounter: InventoryEncounter): Record<string, InventoryItem[]> {
  if (!encounter.inventories) {
    encounter.inventories = {};
  }
  return encounter.inventories;
}

function findItem(list: InventoryItem[], name: string): InventoryItem | undefined {
  const target = name.trim().toLowerCase();
  return list.find((entry) => entry.name.trim().toLowerCase() === target);
}

function addItem(list: InventoryItem[], name: string, qty: number): void {
  if (qty === 0) {
    return;
  }
  const existing = findItem(list, name);
  if (existing) {
    existing.qty += qty;
    if (existing.qty <= 0) {
      list.splice(list.indexOf(existing), 1);
    }
    return;
  }
  if (qty > 0) {
    list.push({ name, qty });
  }
}

function takeItem(list: InventoryItem[], name: string, qty: number): number {
  if (qty <= 0 || list.length === 0) {
    return 0;
  }
  const existing = findItem(list, name);
  if (!existing) {
    return 0;
  }
  const removed = Math.min(qty, existing.qty);
  existing.qty -= removed;
  if (existing.qty <= 0) {
    list.splice(list.indexOf(existing), 1);
  }
  return removed;
}

export function listBag(encounter: EncounterState): InventoryItem[] {
  return ensurePartyBag(encounter as InventoryEncounter);
}

export function listInv(encounter: EncounterState, actorId: string): InventoryItem[] {
  const inventories = ensureInventories(encounter as InventoryEncounter);
  if (!inventories[actorId]) {
    inventories[actorId] = [];
  }
  return inventories[actorId]!;
}

export function giveToActor(
  encounter: EncounterState,
  actorId: string,
  name: string,
  qty: number,
): void {
  const list = listInv(encounter, actorId);
  addItem(list, name, qty);
}

export function giveToParty(encounter: EncounterState, name: string, qty: number): void {
  const list = listBag(encounter);
  addItem(list, name, qty);
}

export function takeFromActor(
  encounter: EncounterState,
  actorId: string,
  name: string,
  qty: number,
): number {
  const list = listInv(encounter, actorId);
  return takeItem(list, name, qty);
}

export function takeFromParty(encounter: EncounterState, name: string, qty: number): number {
  const list = listBag(encounter);
  return takeItem(list, name, qty);
}
