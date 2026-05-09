import { readFile, readdir } from "fs/promises";
import { join } from "path";

const DEFAULT_CURSOR_STATS = {
  model: null as string | null,
  tool_call_count: 0,
  tokens_in: null as number | null,
  tokens_out: null as number | null,
  cost_usd: null as number | null,
};

export type TraceSessionListRow = {
  session_id: string;
  slug: string;
  task: string;
  workspace: string | null;
  started_at: string;
  ended_at: string;
  outcome: string;
  event_count: number;
  cursor_stats: typeof DEFAULT_CURSOR_STATS;
  file: string;
};

function parseStartedMs(iso: string): number {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

/** Enumerate trace sessions under a single traces root (`…/.cursor/traces`). */
export async function sessionsFromDisk(
  tracesRoot: string,
  options?: {
    /** When trace JSON lacks `session.workspace`, fill from the directory we enumerated. */
    inferredWorkspaceFallback?: string | null;
  }
): Promise<TraceSessionListRow[]> {
  const fallback = options?.inferredWorkspaceFallback?.trim() || null;

  const rows: TraceSessionListRow[] = [];
  let topDirs: string[];
  try {
    topDirs = await readdir(tracesRoot);
  } catch {
    return rows;
  }

  for (const dateDir of topDirs) {
    if (dateDir.startsWith(".")) continue;
    const datePath = join(tracesRoot, dateDir);
    let sessionDirs: string[];
    try {
      sessionDirs = await readdir(datePath);
    } catch {
      continue;
    }

    for (const sessionDir of sessionDirs) {
      if (sessionDir.startsWith(".")) continue;
      const sessionPath = join(datePath, sessionDir);
      let files: string[];
      try {
        files = await readdir(sessionPath);
      } catch {
        continue;
      }
      const jsonFile = files.find((f) => f.endsWith(".json"));
      if (!jsonFile) continue;

      let raw: string;
      try {
        raw = await readFile(join(sessionPath, jsonFile), "utf-8");
      } catch {
        continue;
      }

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        continue;
      }

      const session = parsed.session as Record<string, unknown> | undefined;
      const events = Array.isArray(parsed.events) ? parsed.events : [];
      const eventCount = events.length;

      const session_id =
        typeof session?.session_id === "string" && session.session_id.length > 0
          ? session.session_id
          : sessionDir;

      const slug =
        typeof session?.slug === "string" && session.slug.length > 0 ? session.slug : sessionDir;
      const task = typeof session?.task === "string" ? session.task : "";
      const started_at = typeof session?.started_at === "string" ? session.started_at : "";
      const ended_at =
        typeof session?.ended_at === "string" && session.ended_at.length > 0 ? session.ended_at : started_at;
      const outcome =
        typeof session?.outcome === "string" && session.outcome.length > 0
          ? session.outcome
          : "unknown";

      let workspace: string | null = null;
      if (session && "workspace" in session) {
        const w = session.workspace;
        workspace = typeof w === "string" && w.trim() ? w.trim() : null;
      }
      if (!workspace && fallback) workspace = fallback;

      const cs = session?.cursor_stats as Record<string, unknown> | undefined;
      const cursor_stats = {
        model:
          cs && "model" in cs && (typeof cs.model === "string" || cs.model === null)
            ? (cs.model as string | null)
            : DEFAULT_CURSOR_STATS.model,
        tool_call_count:
          typeof cs?.tool_call_count === "number"
            ? cs.tool_call_count
            : DEFAULT_CURSOR_STATS.tool_call_count,
        tokens_in:
          cs && "tokens_in" in cs && (typeof cs.tokens_in === "number" || cs.tokens_in === null)
            ? (cs.tokens_in as number | null)
            : DEFAULT_CURSOR_STATS.tokens_in,
        tokens_out:
          cs && "tokens_out" in cs && (typeof cs.tokens_out === "number" || cs.tokens_out === null)
            ? (cs.tokens_out as number | null)
            : DEFAULT_CURSOR_STATS.tokens_out,
        cost_usd:
          cs && "cost_usd" in cs && (typeof cs.cost_usd === "number" || cs.cost_usd === null)
            ? (cs.cost_usd as number | null)
            : DEFAULT_CURSOR_STATS.cost_usd,
      };

      const relFile = `.cursor/traces/${dateDir}/${sessionDir}/${jsonFile}`;

      rows.push({
        session_id,
        slug,
        task,
        workspace,
        started_at,
        ended_at,
        outcome,
        event_count: eventCount,
        cursor_stats,
        file: relFile,
      });
    }
  }

  const byId = new Map<string, TraceSessionListRow>();
  for (const row of rows) {
    const prev = byId.get(row.session_id);
    if (!prev || parseStartedMs(row.started_at) >= parseStartedMs(prev.started_at)) {
      byId.set(row.session_id, row);
    }
  }

  return [...byId.values()].sort(
    (a, b) => parseStartedMs(b.started_at) - parseStartedMs(a.started_at)
  );
}
