import type { Connection } from '@/lib/firestoreHelpers';
import type { ConnectionPreferences, Goal, PersonalizationSettings } from './types';

export type UserDocForSearch = {
  race?: string[] | string;
  location?: string;
  resumeAspects?: Record<string, unknown>;
  personalizationSettings?: PersonalizationSettings;
};

export type ResumeDocForSearch = {
  text?: string;
};

export function goalTextFrom(
  goals: string | Goal[],
  goalOverride?: string
): string {
  return (
    goalOverride ??
    (typeof goals === 'string' ? goals : goals?.[0]?.title || '') ??
    ''
  );
}

export function parseConnectionPreferences(
  raw: string | null
): ConnectionPreferences | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const obj = parsed as Record<string, unknown>;
    const connections = obj.connections;
    const programs = obj.programs;

    return {
      connections: typeof connections === 'boolean' ? connections : true,
      programs: typeof programs === 'boolean' ? programs : true,
    };
  } catch {
    return null;
  }
}

export function serializeConnectionPreferences(
  prefs: ConnectionPreferences
): string {
  return JSON.stringify(prefs);
}

export function isPendingConnection(c: Connection): boolean {
  return c.status === 'not_contacted' || !c.status;
}

export function upsertConnectionById(
  prev: Connection[],
  next: Connection
): Connection[] {
  const existingIds = new Set(prev.map((c) => c.id));
  return existingIds.has(next.id) ? prev : [...prev, next];
}

/**
 * Remove duplicate connections by `id` while keeping a stable order.
 * If duplicates exist, we prefer the item with the newest `lastUpdated` (if present),
 * otherwise we keep the last occurrence.
 */
export function dedupeConnectionsById(connections: Connection[]): Connection[] {
  const byId = new Map<string, Connection>();

  for (const c of connections) {
    const existing = byId.get(c.id);
    if (!existing) {
      byId.set(c.id, c);
      continue;
    }

    const existingUpdated = (existing as Record<string, unknown>).lastUpdated;
    const nextUpdated = (c as Record<string, unknown>).lastUpdated;

    const existingTs =
      typeof existingUpdated === 'string' ? Date.parse(existingUpdated) : NaN;
    const nextTs =
      typeof nextUpdated === 'string' ? Date.parse(nextUpdated) : NaN;

    if (!Number.isNaN(nextTs) && (Number.isNaN(existingTs) || nextTs >= existingTs)) {
      byId.set(c.id, c);
      continue;
    }

    // If timestamps are missing/unparseable, keep the last occurrence.
    if (Number.isNaN(existingTs) && Number.isNaN(nextTs)) {
      byId.set(c.id, c);
    }
  }

  return Array.from(byId.values());
}

export type ConnectionsRequestBody = {
  goalTitle: string;
  preferences: ConnectionPreferences;
  userId: string;
  race: string;
  location: string;
  resumeAspects: Record<string, unknown>;
  rawResumeText: string;
  personalizationSettings: PersonalizationSettings;
};

export function buildConnectionsRequestBody(params: {
  goalTitle: string;
  preferences: ConnectionPreferences;
  userId: string;
  userDoc: UserDocForSearch;
  resumeDoc: ResumeDocForSearch;
  personalizationSettings: PersonalizationSettings;
}): ConnectionsRequestBody {
  const race = Array.isArray(params.userDoc.race)
    ? params.userDoc.race.join(', ')
    : params.userDoc.race || '';

  return {
    goalTitle: params.goalTitle,
    preferences: params.preferences,
    userId: params.userId,
    race,
    location: params.userDoc.location || '',
    resumeAspects: params.userDoc.resumeAspects || {},
    rawResumeText: params.resumeDoc.text || '',
    personalizationSettings: params.personalizationSettings,
  };
}

export type SseMessage =
  | { type: 'step-update'; step: number }
  | { type: 'connection-found'; connection: Connection }
  | { type: 'complete' }
  | { type: 'error'; message?: string }
  | { type: string; [key: string]: unknown };

/**
 * Parse `text/event-stream` chunks where each payload line looks like `data: {...}`.
 */
export function parseSseChunk(chunk: string): SseMessage[] {
  const out: SseMessage[] = [];
  const lines = chunk.split('\n');
  for (const line of lines) {
    if (!line.startsWith('data: ')) continue;
    try {
      out.push(JSON.parse(line.slice(6)) as SseMessage);
    } catch {
      // ignore parse failures (partial chunk, etc.)
    }
  }
  return out;
}


