"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";

interface FileNode {
  id: string;
  name: string;
  touches: number;
  reads: number;
  writes: number;
  sessions: number;
}

interface FileEdge {
  source: string;
  target: string;
  weight: number;
}

interface TopProject {
  name: string;
  sessions: number;
  lines: number;
  files: number;
}

interface HotSession {
  id: string;
  name: string;
  project: string;
  linesAdded: number;
  linesRemoved: number;
  filesChanged: number;
  contextUsage: number;
  mode: string;
}

interface InsightsData {
  graph: { nodes: FileNode[]; edges: FileEdge[] };
  fileIntelligence?: {
    byDirectory: DirectoryGroup[];
    topPairs: CoModificationPair[];
    maxPairWeight: number;
    fileActivityTimeline: FileActivityTimeline;
    traceSessionCount: number;
  };
  topProjects: TopProject[];
  hottestSessions: HotSession[];
  totals: { totalSessions: number; totalLines: number; totalFiles: number; avgContext: number };
  traceSessions?: { session_id: string; task: string; started_at?: string }[];
  filter?: { workspace: string | null; session: string | null };
}

interface DirectoryGroup {
  dir: string;
  totalTouches: number;
  fileCount: number;
  files: FileNode[];
}

interface CoModificationPair {
  a: string;
  b: string;
  aName: string;
  bName: string;
  weight: number;
}

interface FileActivityTimeline {
  sessions: { id: string; label: string; started_at: string }[];
  rows: {
    fileId: string;
    fileName: string;
    reads: number;
    writes: number;
    touched: boolean[];
  }[];
}

export default function InsightsPage() {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState("");
  const [session, setSession] = useState("");
  const [workspaceOptions, setWorkspaceOptions] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/agents?limit=500")
      .then((r) => r.json())
      .then((d) => {
        const agents = d.agents || [];
        const projects = [...new Set(agents.map((a: { project: string }) => a.project))].sort() as string[];
        setWorkspaceOptions(projects);
      })
      .catch(() => setWorkspaceOptions([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) setLoading(true);
    });
    const q = new URLSearchParams();
    if (workspace) q.set("workspace", workspace);
    if (session) q.set("session", session);
    const url = q.toString() ? `/api/insights?${q.toString()}` : "/api/insights";
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspace, session]);

  useEffect(() => {
    if (!data?.traceSessions?.length || !session) return;
    const stillThere = data.traceSessions.some((t) => t.session_id === session);
    if (!stillThere) queueMicrotask(() => setSession(""));
  }, [data?.traceSessions, session]);

  return (
    <main className="min-h-screen flex flex-col">
      <header className="border-b border-card-border px-6 py-4 flex items-center justify-between shrink-0 gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/" className="text-muted hover:text-foreground transition-colors shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
            </svg>
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight">Insights</h1>
            <p className="text-xs text-muted">Cross-session intelligence — where agents focus and what moves together</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <label className="flex items-center gap-2 text-[11px] text-muted">
            <span className="whitespace-nowrap">Workspace</span>
            <select
              value={workspace}
              onChange={(e) => {
                setWorkspace(e.target.value);
                setSession("");
              }}
              className="bg-card border border-card-border rounded-lg px-2 py-1.5 text-xs text-foreground max-w-[200px]"
            >
              <option value="">All workspaces</option>
              {workspaceOptions.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-[11px] text-muted">
            <span className="whitespace-nowrap">Trace session</span>
            <select
              value={session}
              onChange={(e) => setSession(e.target.value)}
              className="bg-card border border-card-border rounded-lg px-2 py-1.5 text-xs text-foreground max-w-[240px]"
              title={data?.traceSessions?.find((t) => t.session_id === session)?.task}
            >
              <option value="">All sessions in scope</option>
              {(data?.traceSessions || []).map((t) => (
                <option key={t.session_id} value={t.session_id}>
                  {(t.task || t.session_id).slice(0, 72)}
                  {((t.task || t.session_id).length > 72 ? "…" : "")}
                </option>
              ))}
            </select>
          </label>
          <Link href="/traces" className="text-xs text-muted hover:text-accent transition-colors px-3 py-2 rounded-lg hover:bg-card">
            Traces
          </Link>
          <Link href="/" className="text-xs text-muted hover:text-accent transition-colors px-3 py-2 rounded-lg hover:bg-card">
            Board
          </Link>
        </div>
      </header>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-muted">Computing insights...</span>
          </div>
        </div>
      ) : data ? (
        <div className="flex-1 overflow-y-auto">
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 pb-0">
            <SummaryCard
              label="Total Sessions"
              value={data.totals.totalSessions.toString()}
              sublabel={
                session
                  ? "selected trace session"
                  : workspace
                    ? `in “${workspace}”`
                    : "across all projects"
              }
              gradient="from-accent/20 to-accent/5"
            />
            <SummaryCard label="Lines Impacted" value={data.totals.totalLines > 1000 ? `${(data.totals.totalLines / 1000).toFixed(1)}k` : data.totals.totalLines.toString()} sublabel="added + removed" gradient="from-finished/20 to-finished/5" />
            <SummaryCard label="Files Touched" value={data.totals.totalFiles.toString()} sublabel="unique files modified" gradient="from-running/20 to-running/5" />
            <SummaryCard label="Avg Context" value={`${data.totals.avgContext.toFixed(0)}%`} sublabel="budget consumed/session" gradient="from-purple-500/20 to-purple-500/5" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
            {/* File intelligence (replaces force graph) */}
            <div className="lg:col-span-2 space-y-4">
              <FileIntelligencePanel
                fi={data.fileIntelligence}
                graphNodes={data.graph.nodes}
                selectedFileId={selectedFileId}
                onSelectFile={setSelectedFileId}
              />
            </div>

            {/* Top Projects */}
            <div className="bg-card border border-card-border rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-card-border">
                <h2 className="text-sm font-semibold">Top Projects</h2>
                <p className="text-[11px] text-muted mt-0.5">Ranked by total lines impacted</p>
              </div>
              <div className="p-4 space-y-2">
                {data.topProjects.map((p, i) => (
                  <ProjectBar key={p.name} project={p} rank={i + 1} maxLines={data.topProjects[0]?.lines || 1} />
                ))}
              </div>
            </div>
          </div>

          {/* Hottest Sessions */}
          <div className="px-6 pb-6">
            <div className="bg-card border border-card-border rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-card-border">
                <h2 className="text-sm font-semibold">Highest Impact Sessions</h2>
                <p className="text-[11px] text-muted mt-0.5">Sessions ranked by blast radius (lines changed + files touched)</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 p-4">
                {data.hottestSessions.map((s) => (
                  <HotSessionCard key={s.id} session={s} />
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function FileIntelligencePanel({
  fi,
  graphNodes,
  selectedFileId,
  onSelectFile,
}: {
  fi: InsightsData["fileIntelligence"];
  graphNodes: FileNode[];
  selectedFileId: string | null;
  onSelectFile: (id: string | null) => void;
}) {
  const maxTouchesGlobal = useMemo(() => Math.max(1, graphNodes[0]?.touches ?? 1), [graphNodes]);

  if (!fi) {
    return (
      <div className="bg-card border border-card-border rounded-xl overflow-hidden p-8 text-center">
        <p className="text-sm text-foreground/90">Insights response did not include file intelligence.</p>
        <p className="text-xs text-muted mt-2">Hard-refresh the page — the API may have been updated since this tab loaded.</p>
      </div>
    );
  }

  if (fi.byDirectory.length === 0 && fi.topPairs.length === 0 && fi.fileActivityTimeline.rows.length === 0) {
    return (
      <div className="bg-card border border-card-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-card-border">
          <h2 className="text-sm font-semibold">Where agents focus in the repo</h2>
          <p className="text-[11px] text-muted mt-0.5">
            Hotspots, files edited together, and activity across recent trace sessions — no physics, no guesswork.
          </p>
        </div>
        <div className="p-8 text-center">
          <p className="text-sm text-foreground/90 mb-2">No file-level trace data in this scope yet</p>
          <p className="text-xs text-muted max-w-lg mx-auto leading-relaxed">
            When Cursor session traces record files read or modified, this panel fills automatically. Try widening the workspace filter or capturing a new traced session.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-card-border rounded-xl overflow-hidden shadow-sm shadow-black/20">
      <div className="px-5 py-4 border-b border-card-border flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Where agents focus in the repo</h2>
          <p className="text-[11px] text-muted mt-1 max-w-2xl leading-relaxed">
            <span className="text-foreground/80">Tiles</span> size with touch volume — color shows read vs write bias.
            <span className="mx-1.5 text-card-border">|</span>
            <span className="text-foreground/80">Pairs</span> are files often touched in the same trace session (coupling).
            <span className="mx-1.5 text-card-border">|</span>
            <span className="text-foreground/80">Timeline</span> is chronological: which files showed up in which sessions.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <span className="text-[10px] text-muted bg-background px-2 py-1 rounded border border-card-border font-mono whitespace-nowrap">
            {graphNodes.length} files · {fi.traceSessionCount} trace sessions
          </span>
          {selectedFileId && (
            <button
              type="button"
              onClick={() => onSelectFile(null)}
              className="text-[10px] px-2 py-1 rounded-lg border border-card-border bg-background hover:border-accent/40 hover:text-accent transition-colors"
            >
              Clear selection
            </button>
          )}
        </div>
      </div>

      <div className="p-5 space-y-8">
        {/* Legend */}
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-[10px] text-muted">
          <span className="flex items-center gap-1.5">
            <span className="w-8 h-2 rounded-sm bg-gradient-to-r from-emerald-500/70 to-emerald-400/40" /> Read-heavy
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-8 h-2 rounded-sm bg-gradient-to-r from-amber-500/70 to-amber-400/40" /> Write-heavy
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-8 h-2 rounded-sm bg-gradient-to-r from-violet-500/50 to-accent/50" /> Balanced
          </span>
        </div>

        {/* Hotspots by directory */}
        <section>
          <div className="flex items-baseline justify-between gap-2 mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Hotspots by top folder</h3>
            <span className="text-[10px] text-muted">Larger tile = more agent touches in traced work</span>
          </div>
          <div className="space-y-5">
            {fi.byDirectory.map((group) => (
              <DirectoryHotspotBlock
                key={group.dir}
                group={group}
                maxTouchesGlobal={maxTouchesGlobal}
                selectedFileId={selectedFileId}
                onSelectFile={onSelectFile}
              />
            ))}
          </div>
        </section>

        <div className="h-px bg-card-border/80" />

        {/* Co-modification pairs */}
        <section>
          <div className="flex items-baseline justify-between gap-2 mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Often edited together</h3>
            <span className="text-[10px] text-muted">Same trace session — useful for splitting or merging PRs</span>
          </div>
          {fi.topPairs.length === 0 ? (
            <p className="text-xs text-muted py-2">Not enough overlapping files across sessions to show pairs.</p>
          ) : (
            <ul className="space-y-2">
              {fi.topPairs.map((pair) => {
                const barPct = (pair.weight / fi.maxPairWeight) * 100;
                const involvesSelection =
                  selectedFileId && (pair.a === selectedFileId || pair.b === selectedFileId);
                return (
                  <li
                    key={`${pair.a}|||${pair.b}`}
                    className={`rounded-lg border px-3 py-2.5 transition-colors ${
                      involvesSelection
                        ? "border-accent/50 bg-accent/5"
                        : "border-card-border/80 bg-background/40 hover:border-card-border"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-mono">
                      <button
                        type="button"
                        onClick={() => onSelectFile(pair.a)}
                        className="text-left text-foreground/90 hover:text-accent truncate max-w-[42%]"
                        title={pair.a}
                      >
                        {pair.aName}
                      </button>
                      <span className="text-muted shrink-0">⟷</span>
                      <button
                        type="button"
                        onClick={() => onSelectFile(pair.b)}
                        className="text-left text-foreground/90 hover:text-accent truncate max-w-[42%]"
                        title={pair.b}
                      >
                        {pair.bName}
                      </button>
                      <span className="ml-auto text-[10px] tabular-nums text-muted shrink-0">{pair.weight}×</span>
                    </div>
                    <div className="mt-2 h-1 rounded-full bg-card overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-500/80 to-accent/70 transition-all duration-300"
                        style={{ width: `${Math.max(barPct, 4)}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="h-px bg-card-border/80" />

        {/* Session × file matrix */}
        <section>
          <div className="flex items-baseline justify-between gap-2 mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">File presence across sessions</h3>
            <span className="text-[10px] text-muted">Recent traces, oldest → newest</span>
          </div>
          {fi.fileActivityTimeline.sessions.length === 0 || fi.fileActivityTimeline.rows.length === 0 ? (
            <p className="text-xs text-muted py-2">No session timeline in this scope.</p>
          ) : (
            <FileSessionMatrix
              timeline={fi.fileActivityTimeline}
              selectedFileId={selectedFileId}
              onSelectFile={onSelectFile}
            />
          )}
        </section>
      </div>
    </div>
  );
}

function rwHue(node: FileNode): string {
  const t = node.reads + node.writes;
  if (t === 0) return "from-slate-500/50 to-slate-600/30";
  const w = node.writes / t;
  if (w >= 0.55) return "from-amber-500/75 to-amber-600/40";
  if (w <= 0.35) return "from-emerald-500/75 to-emerald-700/45";
  return "from-violet-500/60 to-accent/55";
}

function DirectoryHotspotBlock({
  group,
  maxTouchesGlobal,
  selectedFileId,
  onSelectFile,
}: {
  group: DirectoryGroup;
  maxTouchesGlobal: number;
  selectedFileId: string | null;
  onSelectFile: (id: string | null) => void;
}) {
  const maxLocal = Math.max(...group.files.map((f) => f.touches), 1);
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[12px] font-medium font-mono text-foreground/90 truncate" title={group.dir}>
          {group.dir}
        </span>
        <span className="text-[10px] text-muted tabular-nums shrink-0">
          {group.fileCount} files · {group.totalTouches} touches
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {group.files.map((f) => {
          const flexGrow = Math.max(1, Math.round((f.touches / maxLocal) * 14));
          const selected = selectedFileId === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => onSelectFile(selected ? null : f.id)}
              style={{ flex: `${flexGrow} 1 104px` }}
              className={[
                "min-h-[52px] rounded-lg border text-left px-2.5 py-2 transition-all duration-200",
                "bg-gradient-to-br shadow-sm",
                rwHue(f),
                selected
                  ? "border-accent ring-2 ring-accent/40 scale-[1.02] z-10"
                  : "border-white/5 hover:border-accent/35 hover:brightness-110",
              ].join(" ")}
              title={`${f.id}\n${f.reads} reads · ${f.writes} writes · ${f.sessions} sessions`}
            >
              <div className="text-[11px] font-mono font-medium text-white/95 leading-tight line-clamp-2 break-all">
                {f.name}
              </div>
              <div className="mt-1 flex items-center justify-between text-[9px] text-white/75 font-mono tabular-nums">
                <span>{f.touches} touches</span>
                <span className="opacity-80">{Math.round((f.touches / maxTouchesGlobal) * 100)}% max</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FileSessionMatrix({
  timeline,
  selectedFileId,
  onSelectFile,
}: {
  timeline: FileActivityTimeline;
  selectedFileId: string | null;
  onSelectFile: (id: string | null) => void;
}) {
  const colCount = timeline.sessions.length;
  return (
    <div className="rounded-lg border border-card-border/80 bg-background/30 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[10px] min-w-[520px]">
          <thead>
            <tr className="bg-background/80">
              <th className="sticky left-0 z-20 bg-background/95 backdrop-blur-sm border-b border-r border-card-border px-2 py-2 text-left font-medium text-muted w-[min(32vw,200px)]">
                File
              </th>
              {timeline.sessions.map((s, i) => (
                <th
                  key={s.id}
                  className="border-b border-card-border px-0.5 py-2 text-center font-normal text-muted align-bottom min-w-[22px] max-w-[28px]"
                  title={`${s.label}\n${s.started_at || ""}`}
                >
                  <span className="inline-block rotate-[-68deg] origin-bottom translate-y-1 max-h-[72px] whitespace-nowrap">
                    {i + 1}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {timeline.rows.map((row) => {
              const sel = selectedFileId === row.fileId;
              return (
                <tr key={row.fileId} className={sel ? "bg-accent/8" : undefined}>
                  <td
                    className={`sticky left-0 z-10 border-r border-card-border/80 px-2 py-1 ${sel ? "bg-accent/8" : "bg-background"}`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectFile(sel ? null : row.fileId)}
                      className="text-left font-mono text-[10px] text-foreground/90 hover:text-accent truncate max-w-[200px] block w-full"
                      title={row.fileId}
                    >
                      {row.fileName}
                    </button>
                  </td>
                  {row.touched.map((hit, idx) => (
                    <td key={`${row.fileId}-${idx}`} className="p-0 border-b border-card-border/40 text-center align-middle">
                      <div
                        className={[
                          "mx-auto h-5 w-4 rounded-sm transition-colors duration-200",
                          hit
                            ? "bg-gradient-to-b from-accent/90 to-violet-600/70 shadow-[0_0_12px_rgba(99,102,241,0.25)]"
                            : "bg-card/40",
                          sel && hit ? "ring-1 ring-white/30" : "",
                        ].join(" ")}
                        title={
                          hit
                            ? `Touched in session ${timeline.sessions[idx]?.label || ""}`
                            : "Not in this session"
                        }
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-3 px-3 py-2 border-t border-card-border/80 text-[10px] text-muted bg-background/50">
        <span>
          Columns are trace sessions ({colCount}) — hover headers for task text. Dense dots = that file keeps reappearing.
        </span>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, sublabel, gradient }: { label: string; value: string; sublabel: string; gradient: string }) {
  return (
    <div className={`relative overflow-hidden rounded-xl border border-card-border bg-gradient-to-br ${gradient} p-4`}>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs font-medium mt-0.5">{label}</div>
      <div className="text-[10px] text-muted mt-1">{sublabel}</div>
    </div>
  );
}

function ProjectBar({ project, rank, maxLines }: { project: TopProject; rank: number; maxLines: number }) {
  const pct = (project.lines / maxLines) * 100;
  return (
    <div className="group">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="flex items-center gap-2">
          <span className="text-[10px] text-muted font-mono w-4">#{rank}</span>
          <span className="font-medium truncate max-w-[140px]">{project.name}</span>
        </span>
        <span className="text-[10px] text-muted">{project.sessions} sessions</span>
      </div>
      <div className="h-5 bg-background/50 rounded-md overflow-hidden border border-card-border/50">
        <div
          className="h-full bg-gradient-to-r from-accent/40 to-accent/20 rounded-md flex items-center px-2 transition-all duration-500"
          style={{ width: `${Math.max(pct, 8)}%` }}
        >
          <span className="text-[9px] font-mono text-foreground/70 whitespace-nowrap">
            {project.lines > 1000 ? `${(project.lines / 1000).toFixed(1)}k` : project.lines} lines
          </span>
        </div>
      </div>
    </div>
  );
}

function HotSessionCard({ session }: { session: HotSession }) {
  return (
    <div className="p-3 rounded-lg border border-card-border bg-background/50 hover:border-accent/30 transition-colors">
      <h4 className="text-xs font-medium leading-snug line-clamp-2 mb-2">{session.name}</h4>
      <div className="flex items-center gap-2 text-[10px] text-muted mb-2">
        <span className="px-1.5 py-0.5 rounded bg-card border border-card-border">{session.project}</span>
        <span className="px-1.5 py-0.5 rounded bg-card border border-card-border">{session.mode}</span>
      </div>
      <div className="flex items-center gap-3 text-[10px]">
        <span className="text-finished font-semibold">+{session.linesAdded}</span>
        <span className="text-error font-semibold">-{session.linesRemoved}</span>
        <span className="text-muted">{session.filesChanged} files</span>
      </div>
      {session.contextUsage > 0 && (
        <div className="mt-2 h-1.5 bg-card rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${session.contextUsage > 70 ? "bg-error/60" : session.contextUsage > 40 ? "bg-running/60" : "bg-finished/60"}`}
            style={{ width: `${session.contextUsage}%` }}
          />
        </div>
      )}
    </div>
  );
}
