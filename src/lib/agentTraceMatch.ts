import type { AgentInfo } from "@/app/page";
import { agentTraceWorkspaceRoot } from "@/lib/tracePaths";

/** Trace session list row shape from `/api/traces`. */
export interface TraceSessionRow {
  session_id: string;
  slug: string;
  task: string;
  /** Cursor workspace root when the tracer recorded it (optional on older traces). */
  workspace?: string | null;
  started_at: string;
  ended_at: string;
  outcome: string;
  event_count: number;
  file: string;
}

export function parseTraceInstant(iso: string): Date {
  if (!iso) return new Date(NaN);
  const t = iso.trim();
  if (/^\d+$/.test(t)) {
    const n = parseInt(t, 10);
    return new Date(n < 1e12 ? n * 1000 : n);
  }
  if (/Z$|[+-]\d{2}:?\d{2}$/.test(t)) return new Date(t);
  const withZ = t.includes("T") && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(t) ? `${t}Z` : t;
  return new Date(withZ);
}

/** Extra ms past `lastModified` so traces still match while the UI snapshot lags a live session. */
const AGENT_END_SLACK_MS = 15 * 60 * 1000;

/** Verbs/stopwords that appear in many trace tasks and agent titles (too weak to tie a trace to one agent). */
const OVERLAP_STOP = new Set([
  "agent",
  "agents",
  "trace",
  "traces",
  "session",
  "sessions",
  "workspace",
  "cursor",
  "board",
  "implement",
  "update",
  "creating",
  "create",
  "added",
  "add",
  "fixed",
  "fix",
  "refactor",
  "improve",
  "building",
  "build",
  "scoped",
  "scope",
  "related",
  "filter",
  "filters",
  "layout",
  "sidebar",
  "page",
  "pages",
]);

function lexicalBlobForAgent(agent: AgentInfo): string {
  const st = (agent.subtitle || "").trim();
  const looksLikeFileList = /edited\s|\.tsx\b|\.ts\b|\.md\b|\.json\b/i.test(st) && st.length > 30;
  return looksLikeFileList ? `${agent.name} ${agent.project}` : `${agent.name} ${st} ${agent.project}`;
}

/**
 * Session-tracer tasks for this repo usually name user-visible surfaces or stacks we touched.
 * This is not time-based — it filters out unrelated work (other repos, demo routes) when wording differs.
 */
function traceTaskMentionsThisAppSurfaces(taskRaw: string): boolean {
  const t = taskRaw.toLowerCase();
  const markers = [
    "/traces",
    "agentdetail",
    "tracedag",
    "trace dag",
    "tracedagsvg",
    "agentboard",
    "agenttracematch",
    "reasoning dag",
    "session_trace",
    "session tracer",
    "cursor-session-tracer",
    "insights to workspace",
    "insights page",
    "file relationship",
    "relationship graph",
    "treemap",
    "prompt coach",
    "stats banner",
    "statsbanner",
    "reverse conversation",
    "reverse agent",
    "infinite scroll",
    "theme toggle",
    "browser is live",
    "agent route",
    "transcript window",
  ];
  return markers.some((m) => t.includes(m));
}

/**
 * Shared vocabulary between trace.task and agent name/subtitle (length/stop filtered).
 * Reduces false positives from trivial words like "agent" while keeping task-specific nouns.
 */
function significantWordOverlap(task: string, agent: AgentInfo): boolean {
  const fromText = (s: string): string[] =>
    s
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 5 && !OVERLAP_STOP.has(w));

  const taskWords = new Set(fromText(task));
  if (taskWords.size === 0) return false;

  return fromText(lexicalBlobForAgent(agent)).some((w) => taskWords.has(w));
}

function normalizeWorkspacePath(p: string): string {
  return p.trim().replace(/\\/g, "/").replace(/\/+$/g, "").toLowerCase();
}

/** True when the trace workspace string aligns with the agent's disk root and related path metadata. */
function workspaceMatchesAgent(traceWorkspace: string, agent: AgentInfo): boolean {
  const tw = normalizeWorkspacePath(traceWorkspace);
  if (!tw) return false;

  const primaryRoot = agentTraceWorkspaceRoot(agent);
  const paths: string[] = [];
  if (primaryRoot) paths.push(primaryRoot);

  const w = (agent.workspace || "").trim();
  if (w) paths.push(w);

  const pp = (agent.projectPath || "").trim();
  if (pp.startsWith("/")) paths.push(pp);

  const seen = new Set<string>();
  for (const ap of paths) {
    const key = normalizeWorkspacePath(ap);
    if (!key || seen.has(key)) continue;
    seen.add(key);

    const nw = key;
    if (tw === nw) return true;
    if (tw.startsWith(`${nw}/`) || nw.startsWith(`${tw}/`)) return true;
    const bt = tw.split("/").filter(Boolean).pop() ?? "";
    const ba = nw.split("/").filter(Boolean).pop() ?? "";
    if (bt.length >= 2 && bt === ba) return true;
  }
  return false;
}

export function traceRelatesToAgent(trace: TraceSessionRow, agent: AgentInfo): boolean {
  const t0 = parseTraceInstant(trace.started_at).getTime();
  const t1Raw = parseTraceInstant(trace.ended_at).getTime();
  const t1 = Number.isNaN(t1Raw) ? t0 + 60_000 : Math.max(t1Raw, t0 + 1_000);

  const a0 = agent.createdAt;
  const a1 = Math.max(agent.lastModified, a0 + 1_000) + AGENT_END_SLACK_MS;

  if (Number.isNaN(t0)) return false;
  const timeOverlap = t0 < a1 && t1 > a0;

  const file = (trace.file || "").toLowerCase();
  const task = (trace.task || "").toLowerCase();
  const ws = (agent.workspace || agent.projectPath || "").toLowerCase();
  const folder = ws.split("/").filter(Boolean).pop() || "";
  const projSlug = agent.project.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "");
  const projHyphen = agent.project.toLowerCase().replace(/\s+/g, "-");
  const wsTail = ws.length > 2 ? ws.replace(/^\/users\/[^/]+/i, "") : "";

  /** File path or task text mentions repo folder, project slug, or workspace suffix (not time). */
  const pathOrTaskMatch =
    folder.length >= 2 &&
    (file.includes(folder.toLowerCase()) ||
      task.includes(folder.toLowerCase()) ||
      file.includes(projHyphen) ||
      task.includes(projHyphen) ||
      (projSlug.length >= 3 && (file.includes(projSlug) || task.includes(projSlug))) ||
      (wsTail.length > 2 && (file.includes(wsTail) || task.includes(wsTail))));

  const name = agent.name.trim().toLowerCase();
  const titleMatch =
    name.length >= 4 &&
    (task.includes(name.slice(0, Math.min(52, name.length))) ||
      name
        .split(/\s+/)
        .filter((w) => w.length > 3)
        .some((w) => task.includes(w)));

  const subtitleRaw = (agent.subtitle || "").trim();
  const subtitle = subtitleRaw.toLowerCase();
  const skipSubtitleTokenMatch = /edited\s|\.tsx\b|\.ts\b|\.md\b|\.json\b/i.test(subtitleRaw) && subtitleRaw.length > 30;
  const subtitleMatch =
    !skipSubtitleTokenMatch &&
    subtitle.length >= 4 &&
    (task.includes(subtitle.slice(0, Math.min(48, subtitle.length))) ||
      subtitle
        .split(/\s+/)
        .filter((w) => w.length > 3)
        .some((w) => task.includes(w)));

  const taskMatchesProject =
    projSlug.length >= 3 &&
    (task.includes(agent.project.toLowerCase()) || task.replace(/\s/g, "").includes(projSlug));

  const traceWorkspace = trace.workspace?.trim();
  if (traceWorkspace && !workspaceMatchesAgent(traceWorkspace, agent)) {
    return false;
  }

  const auxiliaryMatch =
    pathOrTaskMatch ||
    titleMatch ||
    subtitleMatch ||
    taskMatchesProject ||
    traceTaskMentionsThisAppSurfaces(trace.task || "") ||
    significantWordOverlap(trace.task || "", agent);

  if (!timeOverlap || !auxiliaryMatch) {
    return false;
  }

  return true;
}
