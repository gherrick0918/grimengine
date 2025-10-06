import {
  addActorTagDetailed,
  getConcentration,
  removeActorTag,
  removeConcentration,
  startConcentration,
  type Actor,
  type ActorTag,
  type ConcentrationEntry,
  type ConcentrationRemovalResult,
  type ConcentrationTagLink,
  type EncounterState,
} from './encounter.js';

export interface DurationSpec {
  rounds?: number;
  seconds?: number;
  encounterClock?: boolean;
  label: string;
}

interface ExpirationDetails {
  expiresAtRound?: number;
  expiresAtTimestamp?: number;
  encounterClock?: boolean;
}

function computeExpiration(state: EncounterState, duration: DurationSpec, now: number): ExpirationDetails {
  const expiresAtRound =
    typeof duration.rounds === 'number' && duration.rounds > 0
      ? state.round + Math.max(0, duration.rounds - 1)
      : undefined;
  const expiresAtTimestamp =
    typeof duration.seconds === 'number' && duration.seconds > 0 ? now + duration.seconds * 1000 : undefined;
  const encounterClock = duration.encounterClock ?? Boolean(duration.rounds && duration.rounds > 0);
  return { expiresAtRound, expiresAtTimestamp, encounterClock };
}

export interface AppliedTagSummary {
  actorId: string;
  actorName: string;
  tag: ActorTag;
}

export interface ConcentrationBreakSummary {
  result: ConcentrationRemovalResult;
  reason?: string;
}

export interface ConcentrationLifecycleResult {
  state: EncounterState;
  concentration: ConcentrationEntry;
  caster: Actor;
  break?: ConcentrationBreakSummary;
}

export interface BlessCastOptions {
  casterId: string;
  targetIds: string[];
  slotLevel?: number;
  duration?: DurationSpec;
  note?: string;
  breakReason?: string;
}

export interface BlessCastResult extends ConcentrationLifecycleResult {
  targets: Actor[];
  effectTags: AppliedTagSummary[];
  concentrationTag?: AppliedTagSummary;
}

export interface HuntersMarkCastOptions {
  casterId: string;
  targetId: string;
  duration?: DurationSpec;
  note?: string;
  breakReason?: string;
}

export interface HuntersMarkCastResult extends ConcentrationLifecycleResult {
  target: Actor;
  effectTags: AppliedTagSummary[];
  concentrationTag?: AppliedTagSummary;
}

export interface HuntersMarkTransferOptions {
  casterId: string;
  targetId: string;
  note?: string;
}

export interface HuntersMarkTransferResult extends ConcentrationLifecycleResult {
  target: Actor;
  previousTarget?: Actor;
  removedTags: AppliedTagSummary[];
  effectTags: AppliedTagSummary[];
  concentrationTag?: AppliedTagSummary;
}

class ConcentrationHelperBase {
  protected state: EncounterState;
  protected readonly now: number;

  constructor(state: EncounterState, now = Date.now()) {
    this.state = state;
    this.now = now;
  }

  protected requireActor(actorId: string): Actor {
    const actor = this.state.actors[actorId];
    if (!actor) {
      throw new Error(`Unknown actor: ${actorId}`);
    }
    return actor;
  }

  protected prepareBreak(casterId: string, reason?: string): ConcentrationBreakSummary | undefined {
    const existing = getConcentration(this.state, casterId);
    if (!existing) {
      return undefined;
    }
    const result = removeConcentration(this.state, casterId);
    this.state = result.state;
    return { result, reason };
  }

  protected pushLink(links: ConcentrationTagLink[] | undefined, link: ConcentrationTagLink): ConcentrationTagLink[] {
    const next = links ? [...links, link] : [link];
    return next;
  }

  protected applyTag(actor: Actor, tag: Omit<ActorTag, 'id' | 'addedAtRound'>): AppliedTagSummary | undefined {
    const { state: nextState, tag: created } = addActorTagDetailed(this.state, actor.id, tag);
    this.state = nextState;
    if (!created) {
      return undefined;
    }
    return { actorId: actor.id, actorName: actor.name, tag: created };
  }

  protected baseLifecycleResult(entry: ConcentrationEntry, caster: Actor, breakSummary?: ConcentrationBreakSummary) {
    return { state: this.state, concentration: entry, caster, break: breakSummary } satisfies ConcentrationLifecycleResult;
  }
}

export class BlessHelper extends ConcentrationHelperBase {
  static defaultDuration(): DurationSpec {
    return { rounds: 10, encounterClock: true, label: '10 rounds' };
  }

  cast(options: BlessCastOptions): BlessCastResult {
    const caster = this.requireActor(options.casterId);
    const duration = options.duration ?? BlessHelper.defaultDuration();
    const expiration = computeExpiration(this.state, duration, this.now);

    const level = options.slotLevel ?? 1;
    if (!Number.isFinite(level) || level < 1) {
      throw new Error('Bless slot level must be at least 1.');
    }

    const allowedTargets = 3 + Math.max(0, Math.floor(level) - 1);
    const uniqueTargets = Array.from(new Set(options.targetIds.map((id) => id.trim()).filter((id) => id.length > 0)));
    if (uniqueTargets.length === 0) {
      throw new Error('Bless requires at least one target.');
    }
    if (uniqueTargets.length > allowedTargets) {
      throw new Error(`Too many targets (max ${allowedTargets} at level ${level}).`);
    }

    const targets = uniqueTargets.map((id) => this.requireActor(id));
    const breakSummary = this.prepareBreak(caster.id, options.breakReason);

    let links: ConcentrationTagLink[] | undefined;
    const effectTags: AppliedTagSummary[] = [];

    targets.forEach((target) => {
      const applied = this.applyTag(target, {
        text: 'effect:bless',
        expiresAtRound: expiration.expiresAtRound,
        expiresAtTimestamp: expiration.expiresAtTimestamp,
        encounterClock: expiration.encounterClock,
        note: '+1d4 to attack rolls and saving throws',
        source: caster.name,
      });
      if (applied) {
        effectTags.push(applied);
        links = this.pushLink(links, { actorId: target.id, tagId: applied.tag.id });
      }
    });

    const concentrationTag = this.applyTag(caster, {
      text: 'concentration:bless',
      expiresAtRound: expiration.expiresAtRound,
      expiresAtTimestamp: expiration.expiresAtTimestamp,
      encounterClock: expiration.encounterClock,
      note: `Maintaining Bless (${duration.label})`,
      source: caster.name,
    });
    if (concentrationTag) {
      links = this.pushLink(links, { actorId: caster.id, tagId: concentrationTag.tag.id });
    }

    const entry: ConcentrationEntry = {
      casterId: caster.id,
      spellId: 'bless',
      spellName: 'Bless',
      targetId: targets[0]?.id,
      targetIds: targets.map((target) => target.id),
      durationLabel: duration.label,
      note: options.note,
      linkedTags: links,
      expiresAtRound: expiration.expiresAtRound,
      expiresAtTimestamp: expiration.expiresAtTimestamp,
      encounterClock: expiration.encounterClock,
    };

    this.state = startConcentration(this.state, entry);

    return {
      ...this.baseLifecycleResult(entry, caster, breakSummary),
      targets,
      effectTags,
      concentrationTag,
    };
  }
}

export class HuntersMarkHelper extends ConcentrationHelperBase {
  static defaultDuration(): DurationSpec {
    return { seconds: 3600, encounterClock: false, label: '1 hour' };
  }

  cast(options: HuntersMarkCastOptions): HuntersMarkCastResult {
    const caster = this.requireActor(options.casterId);
    const target = this.requireActor(options.targetId);
    const duration = options.duration ?? HuntersMarkHelper.defaultDuration();
    const expiration = computeExpiration(this.state, duration, this.now);

    const breakSummary = this.prepareBreak(caster.id, options.breakReason);

    let links: ConcentrationTagLink[] | undefined;
    const effectTags: AppliedTagSummary[] = [];

    const damageTag = this.applyTag(target, {
      text: 'effect:hunters-mark',
      expiresAtRound: expiration.expiresAtRound,
      expiresAtTimestamp: expiration.expiresAtTimestamp,
      encounterClock: expiration.encounterClock,
      note: '+1d6 weapon damage from caster',
      source: caster.name,
    });
    if (damageTag) {
      effectTags.push(damageTag);
      links = this.pushLink(links, { actorId: target.id, tagId: damageTag.tag.id });
    }

    const markerTag = this.applyTag(target, {
      text: `marked-by:${caster.id}`,
      expiresAtRound: expiration.expiresAtRound,
      expiresAtTimestamp: expiration.expiresAtTimestamp,
      encounterClock: expiration.encounterClock,
      note: "Hunter's Mark",
      source: caster.name,
    });
    if (markerTag) {
      effectTags.push(markerTag);
      links = this.pushLink(links, { actorId: target.id, tagId: markerTag.tag.id });
    }

    const concentrationTag = this.applyTag(caster, {
      text: 'concentration:hunters-mark',
      expiresAtRound: expiration.expiresAtRound,
      expiresAtTimestamp: expiration.expiresAtTimestamp,
      encounterClock: expiration.encounterClock,
      note: `Maintaining Hunter's Mark (${duration.label})`,
      source: caster.name,
    });
    if (concentrationTag) {
      links = this.pushLink(links, { actorId: caster.id, tagId: concentrationTag.tag.id });
    }

    const entry: ConcentrationEntry = {
      casterId: caster.id,
      spellId: 'hunters-mark',
      spellName: "Hunter's Mark",
      targetId: target.id,
      targetIds: [target.id],
      durationLabel: duration.label,
      note: options.note,
      linkedTags: links,
      expiresAtRound: expiration.expiresAtRound,
      expiresAtTimestamp: expiration.expiresAtTimestamp,
      encounterClock: expiration.encounterClock,
    };

    this.state = startConcentration(this.state, entry);

    return {
      ...this.baseLifecycleResult(entry, caster, breakSummary),
      target,
      effectTags,
      concentrationTag,
    };
  }

  transfer(options: HuntersMarkTransferOptions): HuntersMarkTransferResult {
    const caster = this.requireActor(options.casterId);
    const target = this.requireActor(options.targetId);
    const entry = getConcentration(this.state, caster.id);
    if (!entry || entry.spellId !== 'hunters-mark') {
      throw new Error('No active Hunter\'s Mark concentration to transfer.');
    }

    const previousTargetId = entry.targetId;
    const previousTarget = previousTargetId ? this.state.actors[previousTargetId] : undefined;

    const remainingLinks: ConcentrationTagLink[] = [];
    const removedSummaries: AppliedTagSummary[] = [];

    (entry.linkedTags ?? []).forEach((link) => {
      if (link.actorId === caster.id) {
        remainingLinks.push({ ...link });
        return;
      }
      if (previousTargetId && link.actorId === previousTargetId) {
        const actor = this.state.actors[link.actorId];
        const tag = actor?.tags?.find((item) => item.id === link.tagId);
        if (actor && tag) {
          const summary: AppliedTagSummary = { actorId: actor.id, actorName: actor.name, tag };
          removedSummaries.push(summary);
          this.state = removeActorTag(this.state, actor.id, tag.id);
        }
        return;
      }
      remainingLinks.push({ ...link });
    });

    const expiration: ExpirationDetails = {
      expiresAtRound: entry.expiresAtRound,
      expiresAtTimestamp: entry.expiresAtTimestamp,
      encounterClock: entry.encounterClock,
    };

    const effectTags: AppliedTagSummary[] = [];

    const damageTag = this.applyTag(target, {
      text: 'effect:hunters-mark',
      expiresAtRound: expiration.expiresAtRound,
      expiresAtTimestamp: expiration.expiresAtTimestamp,
      encounterClock: expiration.encounterClock,
      note: '+1d6 weapon damage from caster',
      source: caster.name,
    });
    if (damageTag) {
      effectTags.push(damageTag);
      remainingLinks.push({ actorId: target.id, tagId: damageTag.tag.id });
    }

    const markerTag = this.applyTag(target, {
      text: `marked-by:${caster.id}`,
      expiresAtRound: expiration.expiresAtRound,
      expiresAtTimestamp: expiration.expiresAtTimestamp,
      encounterClock: expiration.encounterClock,
      note: "Hunter's Mark",
      source: caster.name,
    });
    if (markerTag) {
      effectTags.push(markerTag);
      remainingLinks.push({ actorId: target.id, tagId: markerTag.tag.id });
    }

    const updatedEntry: ConcentrationEntry = {
      ...entry,
      targetId: target.id,
      targetIds: [target.id],
      linkedTags: remainingLinks,
      note: options.note ?? entry.note,
    };

    const concentration = { ...(this.state.concentration ?? {}) };
    concentration[caster.id] = updatedEntry;
    this.state = { ...this.state, concentration };

    return {
      ...this.baseLifecycleResult(updatedEntry, caster),
      target,
      previousTarget,
      removedTags: removedSummaries,
      effectTags,
      concentrationTag: undefined,
    };
  }
}
