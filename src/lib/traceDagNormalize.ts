/**
 * Normalize session-tracer JSON for the reasoning DAG UI: extract step arrays,
 * coerce field names, and ensure at least one root so SVG layout succeeds.
 */

import { parseTraceInstant } from "@/lib/agentTraceMatch";

/** One row stored by the tracer / consumed by `TraceDagSvg`. */
export interface DagTraceEvent {
  step_id: string;
  parent_step_id: string | null;
  type: string;
  timestamp: string;
  reason: string;
  files_read: string[];
  files_modified: string[];
  files_created: string[];
  files_deleted: string[];
  notes?: string;
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function strOrNull(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v;
  return null;
}

/** Whether `pid` attaches the step under the DAG virtual root. */
function isRootParent(
  pid: string | null | undefined,
  sessionId: string,
  byId: Map<string, DagTraceEvent>
): boolean {
  if (pid == null || pid === "") return true;
  if (pid === "root") return true;
  if (pid === sessionId) return true;
  if (!byId.has(pid)) return true;
  return false;
}

/** Map a tracer row (snake_case or camelCase) into DagTraceEvent, or skip if unusable. */
export function coerceTraceRow(row: unknown): DagTraceEvent | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const stepId = str(r.step_id || r.stepId);
  if (!stepId) return null;
  const parentRaw = strOrNull(r.parent_step_id ?? r.parentStepId);
  const readArr = (k: string, kCamel: string): string[] => {
    const v = r[k] ?? r[kCamel];
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  };
  const notesRaw = strOrNull(r.notes ?? r.note);
  const out: DagTraceEvent = {
    step_id: stepId,
    parent_step_id: parentRaw,
    type: str(r.type, "checkpoint"),
    timestamp: str(r.timestamp, ""),
    reason: str(r.reason, ""),
    files_read: readArr("files_read", "filesRead"),
    files_modified: readArr("files_modified", "filesModified"),
    files_created: readArr("files_created", "filesCreated"),
    files_deleted: readArr("files_deleted", "filesDeleted"),
    ...(notesRaw ? { notes: notesRaw } : {}),
  };
  return out;
}

export function extractTraceRows(parsed: Record<string, unknown>): unknown[] {
  const raw = parsed.events ?? parsed.steps;
  return Array.isArray(raw) ? raw : [];
}

/**
 * Ensures parent links form at least one root for `buildTree` (break self-edges,
 * then break all-internal-parent cycles).
 */
export function sanitizeTraceLinkage(events: DagTraceEvent[], sessionId: string): DagTraceEvent[] {
  let next = events.map((e) => ({
    ...e,
    parent_step_id:
      e.parent_step_id === e.step_id ? null : e.parent_step_id,
  }));

  let byId = new Map(next.map((e) => [e.step_id, e]));

  let hasNaturalRoot = next.some((e) => isRootParent(e.parent_step_id, sessionId, byId));
  if (!hasNaturalRoot && next.length > 0) {
    const sorted = [...next].sort((a, b) => {
      const ta = parseTraceInstant(a.timestamp).getTime();
      const tb = parseTraceInstant(b.timestamp).getTime();
      if (Number.isNaN(ta) && Number.isNaN(tb)) return a.step_id.localeCompare(b.step_id);
      if (Number.isNaN(ta)) return 1;
      if (Number.isNaN(tb)) return -1;
      return ta - tb || a.step_id.localeCompare(b.step_id);
    });
    const first = sorted[0]!;
    next = next.map((e) =>
      e.step_id === first.step_id ? { ...e, parent_step_id: null } : e
    );
    byId = new Map(next.map((e) => [e.step_id, e]));
  }

  // Defensive second pass — first step forced root may collide with MCP edge cases.
  hasNaturalRoot = next.some((e) => isRootParent(e.parent_step_id, sessionId, byId));
  if (!hasNaturalRoot && next.length > 0) {
    next = next.map((e, i) => (i === 0 ? { ...e, parent_step_id: null } : e));
  }

  return next;
}

/** Coerce envelope from disk / API JSON into DagTraceEvents with stable linkage for the DAG. */
export function normalizeTraceEnvelope(parsed: Record<string, unknown>, lookupSessionId: string): DagTraceEvent[] {
  const sessionBlock = parsed.session && typeof parsed.session === "object" ? (parsed.session as Record<string, unknown>) : null;
  const sessionSid = sessionBlock ? str(sessionBlock.session_id || sessionBlock.sessionId) : "";
  const sid = sessionSid || lookupSessionId;
  const rows = extractTraceRows(parsed)
    .map(coerceTraceRow)
    .filter((e): e is DagTraceEvent => e !== null);
  const dedup = dedupeStepsById(rows);
  return sanitizeTraceLinkage(dedup, sid);
}

function dedupeStepsById(events: DagTraceEvent[]): DagTraceEvent[] {
  const m = new Map<string, DagTraceEvent>();
  for (const e of events) {
    m.set(e.step_id, e);
  }
  return [...m.values()];
}
