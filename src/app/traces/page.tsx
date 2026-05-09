"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface TraceSession {
  session_id: string;
  slug: string;
  task: string;
  started_at: string;
  ended_at: string;
  outcome: string;
  event_count: number;
  cursor_stats: {
    model: string | null;
    tool_call_count: number;
    tokens_in: number | null;
    tokens_out: number | null;
    cost_usd: number | null;
  };
  file: string;
}

interface TraceEvent {
  step_id: string;
  parent_step_id: string | null;
  type: string;
  timestamp: string;
  reason: string;
  files_read: string[];
  files_modified: string[];
  files_created: string[];
  files_deleted: string[];
  notes: string;
}

interface TraceDetail {
  session: {
    session_id: string;
    slug: string;
    task: string;
    started_at: string;
    ended_at: string;
    outcome: string;
    repo_snapshot: string[];
    cursor_stats: {
      model: string | null;
      tool_call_count: number;
      tokens_in: number | null;
      tokens_out: number | null;
      cost_usd: number | null;
    };
  };
  events: TraceEvent[];
}

export default function TracesPage() {
  const [sessions, setSessions] = useState<TraceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrace, setSelectedTrace] = useState<TraceDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    fetch("/api/traces")
      .then((r) => r.json())
      .then((d) => setSessions(d.sessions || []))
      .finally(() => setLoading(false));
  }, []);

  const openTrace = useCallback(async (sessionId: string) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/traces/${sessionId}`);
      const data = await res.json();
      if (!data.error) setSelectedTrace(data);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  return (
    <main className="min-h-screen flex flex-col">
      <header className="border-b border-card-border px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-muted hover:text-foreground transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Trace Explorer</h1>
            <p className="text-xs text-muted">{sessions.length} reasoning traces captured</p>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Session list sidebar */}
        <aside className="w-80 border-r border-card-border overflow-y-auto p-4 space-y-2 shrink-0">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-muted text-center py-8">No traces yet. Run a multi-file task with the tracer MCP enabled.</p>
          ) : (
            sessions.map((s) => (
              <button
                key={s.session_id}
                onClick={() => openTrace(s.session_id)}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  selectedTrace?.session.session_id === s.session_id
                    ? "border-accent bg-accent/10"
                    : "border-card-border bg-card hover:border-accent/40"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium leading-snug line-clamp-2">{s.task}</p>
                  <OutcomeBadge outcome={s.outcome} />
                </div>
                <div className="mt-2 flex items-center gap-3 text-[11px] text-muted">
                  <span>{s.event_count} steps</span>
                  {s.cursor_stats.model && <span className="truncate">{s.cursor_stats.model}</span>}
                  {s.cursor_stats.cost_usd && <span>${s.cursor_stats.cost_usd.toFixed(2)}</span>}
                </div>
                <time className="block mt-1 text-[10px] text-muted/70 font-mono">
                  {new Date(s.started_at).toLocaleString()}
                </time>
              </button>
            ))
          )}
        </aside>

        {/* Main trace visualization area */}
        <section className="flex-1 overflow-y-auto p-6">
          {loadingDetail ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : selectedTrace ? (
            <TraceDetailView trace={selectedTrace} />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-sm">
                <div className="w-16 h-16 rounded-2xl bg-card border border-card-border flex items-center justify-center mx-auto mb-4">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                  </svg>
                </div>
                <h2 className="text-lg font-medium mb-2">Select a trace</h2>
                <p className="text-sm text-muted">Click on a session from the sidebar to visualize its reasoning chain.</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function TraceDetailView({ trace }: { trace: TraceDetail }) {
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"graph" | "timeline" | "files">("graph");

  const allFiles = getFileHeatmap(trace.events);
  const duration = getDuration(trace.session.started_at, trace.session.ended_at);

  return (
    <div className="space-y-6 slide-up">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold leading-snug">{trace.session.task}</h2>
          <div className="flex items-center gap-3 mt-2 text-sm text-muted">
            <OutcomeBadge outcome={trace.session.outcome} />
            <span>{trace.events.length} steps</span>
            <span>{duration}</span>
            {trace.session.cursor_stats.model && (
              <span className="px-2 py-0.5 rounded bg-card border border-card-border text-xs font-mono">
                {trace.session.cursor_stats.model}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-1 bg-card border border-card-border rounded-lg p-0.5">
          {(["graph", "timeline", "files"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === mode ? "bg-accent text-white" : "text-muted hover:text-foreground"
              }`}
            >
              {mode === "graph" ? "Graph" : mode === "timeline" ? "Timeline" : "Files"}
            </button>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <MiniStat label="Steps" value={trace.events.length.toString()} />
        <MiniStat label="Files Scope" value={trace.session.repo_snapshot.length.toString()} />
        <MiniStat label="Tool Calls" value={(trace.session.cursor_stats.tool_call_count || 0).toString()} />
        <MiniStat
          label="Tokens"
          value={
            trace.session.cursor_stats.tokens_in
              ? `${((trace.session.cursor_stats.tokens_in + (trace.session.cursor_stats.tokens_out || 0)) / 1000).toFixed(1)}k`
              : "—"
          }
        />
        <MiniStat
          label="Cost"
          value={trace.session.cursor_stats.cost_usd ? `$${trace.session.cursor_stats.cost_usd.toFixed(2)}` : "—"}
        />
      </div>

      {/* View modes */}
      {viewMode === "graph" && (
        <DecisionGraph events={trace.events} expandedStep={expandedStep} onToggle={setExpandedStep} />
      )}
      {viewMode === "timeline" && (
        <TimelineView events={trace.events} expandedStep={expandedStep} onToggle={setExpandedStep} />
      )}
      {viewMode === "files" && <FileHeatmap files={allFiles} />}
    </div>
  );
}

function DecisionGraph({
  events,
  expandedStep,
  onToggle,
}: {
  events: TraceEvent[];
  expandedStep: string | null;
  onToggle: (id: string | null) => void;
}) {
  return (
    <div className="relative">
      {/* SVG connector lines */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden>
        {events.map((ev, idx) => {
          if (!ev.parent_step_id) return null;
          const parentIdx = events.findIndex((e) => e.step_id === ev.parent_step_id);
          if (parentIdx < 0) return null;
          const y1 = parentIdx * 140 + 60;
          const y2 = idx * 140 + 20;
          return (
            <line
              key={ev.step_id}
              x1="32"
              y1={y1}
              x2="32"
              y2={y2}
              stroke="var(--accent)"
              strokeWidth="2"
              strokeDasharray="4 3"
              opacity="0.4"
            />
          );
        })}
      </svg>

      <div className="relative space-y-4">
        {events.map((ev, idx) => {
          const isExpanded = expandedStep === ev.step_id;
          const totalFiles = ev.files_read.length + ev.files_modified.length + ev.files_created.length + ev.files_deleted.length;

          return (
            <div
              key={ev.step_id}
              className="trace-step-enter relative flex gap-4"
              style={{ animationDelay: `${idx * 60}ms` }}
            >
              {/* Node indicator */}
              <div className="flex flex-col items-center shrink-0 pt-1">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border-2 ${
                  ev.type === "decision"
                    ? "border-accent/60 bg-accent/15"
                    : ev.type === "file_modify"
                      ? "border-running/60 bg-running/15"
                      : "border-finished/60 bg-finished/15"
                }`}>
                  {ev.type === "decision" ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 16v-4M12 8h.01" />
                    </svg>
                  ) : ev.type === "file_modify" ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-running">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-finished">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                  )}
                </div>
              </div>

              {/* Card */}
              <button
                onClick={() => onToggle(isExpanded ? null : ev.step_id)}
                className="flex-1 text-left trace-card-glow rounded-xl border border-card-border bg-card overflow-hidden"
              >
                <div className="px-4 py-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="font-mono text-[10px] text-muted">{ev.step_id}</span>
                    <TypeBadge type={ev.type} />
                    <time className="ml-auto text-[10px] text-muted font-mono">
                      {new Date(ev.timestamp).toLocaleTimeString()}
                    </time>
                  </div>
                  <p className={`text-sm leading-relaxed ${isExpanded ? "" : "line-clamp-2"}`}>
                    {ev.reason}
                  </p>

                  {/* Compact file summary */}
                  {!isExpanded && totalFiles > 0 && (
                    <div className="mt-2 flex items-center gap-2 text-[10px] text-muted">
                      {ev.files_read.length > 0 && (
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          {ev.files_read.length} read
                        </span>
                      )}
                      {ev.files_modified.length > 0 && (
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-running" />
                          {ev.files_modified.length} modified
                        </span>
                      )}
                      {ev.files_created.length > 0 && (
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                          {ev.files_created.length} created
                        </span>
                      )}
                    </div>
                  )}

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="mt-3 space-y-3 border-t border-card-border pt-3">
                      {ev.files_read.length > 0 && (
                        <FileList label="Read" files={ev.files_read} color="emerald" />
                      )}
                      {ev.files_modified.length > 0 && (
                        <FileList label="Modified" files={ev.files_modified} color="amber" />
                      )}
                      {ev.files_created.length > 0 && (
                        <FileList label="Created" files={ev.files_created} color="indigo" />
                      )}
                      {ev.files_deleted.length > 0 && (
                        <FileList label="Deleted" files={ev.files_deleted} color="red" />
                      )}
                      {ev.notes && (
                        <div className="text-xs text-muted italic border-l-2 border-card-border pl-3">
                          {ev.notes}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TimelineView({
  events,
  expandedStep,
  onToggle,
}: {
  events: TraceEvent[];
  expandedStep: string | null;
  onToggle: (id: string | null) => void;
}) {
  if (events.length === 0) return null;

  const startTime = new Date(events[0].timestamp).getTime();
  const endTime = new Date(events[events.length - 1].timestamp).getTime();
  const totalDuration = Math.max(endTime - startTime, 1000);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px] text-muted font-mono mb-3 px-1">
        <span>{new Date(events[0].timestamp).toLocaleTimeString()}</span>
        <span>{new Date(events[events.length - 1].timestamp).toLocaleTimeString()}</span>
      </div>
      {events.map((ev, idx) => {
        const offset = ((new Date(ev.timestamp).getTime() - startTime) / totalDuration) * 100;
        const isExpanded = expandedStep === ev.step_id;

        return (
          <div
            key={ev.step_id}
            className="trace-step-enter"
            style={{ animationDelay: `${idx * 40}ms` }}
          >
            <button
              onClick={() => onToggle(isExpanded ? null : ev.step_id)}
              className="w-full text-left group"
            >
              <div className="flex items-center gap-3">
                <div className="w-16 text-right text-[10px] text-muted font-mono shrink-0">
                  {new Date(ev.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </div>
                <div className="flex-1 relative h-8 bg-card border border-card-border rounded-lg overflow-hidden group-hover:border-accent/40 transition-colors">
                  <div
                    className={`absolute top-0 left-0 h-full rounded-lg ${
                      ev.type === "decision" ? "bg-accent/30" : ev.type === "file_modify" ? "bg-running/30" : "bg-finished/30"
                    }`}
                    style={{ width: `${Math.max(offset + 8, 15)}%` }}
                  />
                  <div className="relative flex items-center gap-2 h-full px-3">
                    <TypeBadge type={ev.type} />
                    <span className="text-xs truncate">{ev.reason.slice(0, 80)}</span>
                  </div>
                </div>
              </div>
              {isExpanded && (
                <div className="ml-19 mt-2 mb-3 p-3 bg-card border border-card-border rounded-lg text-sm">
                  <p className="leading-relaxed mb-2">{ev.reason}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {[...ev.files_read, ...ev.files_modified, ...ev.files_created].map((f, i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-background border border-card-border text-[10px] font-mono truncate max-w-[200px]">
                        {f.split("/").pop()}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function FileHeatmap({ files }: { files: { path: string; reads: number; writes: number; creates: number }[] }) {
  const maxTouches = Math.max(...files.map((f) => f.reads + f.writes + f.creates), 1);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-500/40" /> Read</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-running/40" /> Modified</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-accent/40" /> Created</span>
      </div>
      <div className="space-y-1.5">
        {files.map((f) => {
          const total = f.reads + f.writes + f.creates;
          const pct = (total / maxTouches) * 100;
          return (
            <div key={f.path} className="trace-step-enter flex items-center gap-3 group">
              <div className="w-48 sm:w-64 text-right truncate">
                <span className="text-xs font-mono text-foreground/80 group-hover:text-foreground transition-colors" title={f.path}>
                  {f.path}
                </span>
              </div>
              <div className="flex-1 h-7 bg-card border border-card-border rounded-md overflow-hidden relative">
                {f.reads > 0 && (
                  <div
                    className="absolute top-0 left-0 h-full bg-emerald-500/35"
                    style={{ width: `${(f.reads / maxTouches) * 100}%` }}
                  />
                )}
                {f.writes > 0 && (
                  <div
                    className="absolute top-0 h-full bg-running/35"
                    style={{ left: `${(f.reads / maxTouches) * 100}%`, width: `${(f.writes / maxTouches) * 100}%` }}
                  />
                )}
                {f.creates > 0 && (
                  <div
                    className="absolute top-0 h-full bg-accent/35"
                    style={{ left: `${((f.reads + f.writes) / maxTouches) * 100}%`, width: `${(f.creates / maxTouches) * 100}%` }}
                  />
                )}
                <div className="relative h-full flex items-center px-2">
                  <span className="text-[10px] font-mono text-foreground/70">{total}x</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FileList({ label, files, color }: { label: string; files: string[]; color: string }) {
  const colorMap: Record<string, string> = {
    emerald: "border-emerald-500/30 bg-emerald-500/8 text-emerald-300",
    amber: "border-running/30 bg-running/8 text-amber-200",
    indigo: "border-accent/30 bg-accent/8 text-indigo-200",
    red: "border-error/30 bg-error/8 text-red-200",
  };
  return (
    <div>
      <span className="text-[10px] uppercase tracking-wider text-muted font-semibold">{label}</span>
      <div className="flex flex-wrap gap-1.5 mt-1">
        {files.map((f, i) => (
          <span key={i} className={`px-2 py-0.5 rounded-md border text-[10px] font-mono ${colorMap[color] || ""}`}>
            {f.split("/").pop()}
          </span>
        ))}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card border border-card-border rounded-lg px-3 py-2">
      <dt className="text-[10px] text-muted uppercase tracking-wider">{label}</dt>
      <dd className="text-sm font-semibold mt-0.5">{value}</dd>
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    decision: "bg-accent/15 text-accent border-accent/25",
    file_modify: "bg-running/15 text-running border-running/25",
    checkpoint: "bg-finished/15 text-finished border-finished/25",
    tool_call: "bg-muted/15 text-muted border-muted/25",
  };
  return (
    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider border ${styles[type] || styles.tool_call}`}>
      {type.replace("_", " ")}
    </span>
  );
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  const styles: Record<string, string> = {
    completed: "bg-finished/15 text-finished",
    partial: "bg-running/15 text-running",
    aborted: "bg-error/15 text-error",
  };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${styles[outcome] || "bg-muted/15 text-muted"}`}>
      {outcome}
    </span>
  );
}

function getDuration(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return "<1s";
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  return `${Math.round(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

function getFileHeatmap(events: TraceEvent[]) {
  const map = new Map<string, { reads: number; writes: number; creates: number }>();

  for (const ev of events) {
    for (const f of ev.files_read) {
      const e = map.get(f) || { reads: 0, writes: 0, creates: 0 };
      e.reads++;
      map.set(f, e);
    }
    for (const f of ev.files_modified) {
      const e = map.get(f) || { reads: 0, writes: 0, creates: 0 };
      e.writes++;
      map.set(f, e);
    }
    for (const f of ev.files_created) {
      const e = map.get(f) || { reads: 0, writes: 0, creates: 0 };
      e.creates++;
      map.set(f, e);
    }
  }

  return [...map.entries()]
    .map(([path, counts]) => ({ path, ...counts }))
    .sort((a, b) => (b.reads + b.writes + b.creates) - (a.reads + a.writes + a.creates));
}
