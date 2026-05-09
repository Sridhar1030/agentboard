"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import type { AgentInfo, ConversationEntry } from "@/app/page";
import { TraceView } from "@/components/TraceView";
import { parseTraceInstant, traceRelatesToAgent, type TraceSessionRow } from "@/lib/agentTraceMatch";
import { agentTraceWorkspaceRoot } from "@/lib/tracePaths";

interface AgentDetailPanelProps {
  agentId: string;
  onClose: () => void;
}

type TraceSession = TraceSessionRow;

interface AgentDetail {
  agent: AgentInfo;
  conversation: ConversationEntry[];
  totalEntries: number;
  hasMore: boolean;
}

const PAGE_SIZE = 50;

export function AgentDetailPanel({ agentId, onClose }: AgentDetailPanelProps) {
  const [data, setData] = useState<AgentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [panelTab, setPanelTab] = useState<"transcript" | "traces">("transcript");
  const [traceSessions, setTraceSessions] = useState<TraceSession[]>([]);
  const [tracesLoading, setTracesLoading] = useState(false);

  useEffect(() => {
    async function fetchDetail() {
      try {
        const res = await fetch(`/api/agents/${agentId}?offset=0&limit=${PAGE_SIZE}`);
        const json = await res.json();
        if (json.error) {
          setError(json.error);
        } else {
          setData(json);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    }
    fetchDetail();
  }, [agentId]);

  useEffect(() => {
    queueMicrotask(() => setPanelTab("transcript"));
  }, [agentId]);

  const traceWorkspaceForApi = useMemo(
    () => (data?.agent ? agentTraceWorkspaceRoot(data.agent) : null),
    [data]
  );

  useEffect(() => {
    if (loading || !data?.agent) return;
    queueMicrotask(() => setTracesLoading(true));
    const qs =
      traceWorkspaceForApi ?
        `?workspace=${encodeURIComponent(traceWorkspaceForApi)}`
      : "";
    void fetch(`/api/traces${qs}`)
      .then((r) => r.json())
      .then((d) => setTraceSessions((d.sessions || []) as TraceSession[]))
      .catch(() => setTraceSessions([]))
      .finally(() => setTracesLoading(false));
  }, [agentId, loading, traceWorkspaceForApi, data?.agent]);

  const relatedTraces = useMemo(() => {
    if (!data?.agent) return [];
    return traceSessions
      .filter((t) => traceRelatesToAgent(t, data.agent))
      .sort((a, b) => parseTraceInstant(b.started_at).getTime() - parseTraceInstant(a.started_at).getTime());
  }, [data, traceSessions]);

  const loadMore = useCallback(async () => {
    if (!data || loadingMore || !data.hasMore) return;
    setLoadingMore(true);
    try {
      const offset = data.conversation.length;
      const res = await fetch(`/api/agents/${agentId}?offset=${offset}&limit=${PAGE_SIZE}`);
      const json = await res.json();
      if (!json.error) {
        setData({
          ...data,
          conversation: [...data.conversation, ...json.conversation],
          hasMore: json.hasMore,
          totalEntries: json.totalEntries,
        });
      }
    } catch {} finally {
      setLoadingMore(false);
    }
  }, [agentId, data, loadingMore]);

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-3xl bg-background border-l border-card-border h-full overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-card-border bg-background/95 px-6 py-4 backdrop-blur-sm">
          <div className="flex min-w-0 flex-1 items-center gap-3 pr-2">
            <h2 className="truncate text-base font-semibold">Agent Details</h2>
            <Link
              href={`/agent/${agentId}`}
              className="shrink-0 rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-1 text-[11px] font-semibold text-accent transition hover:bg-accent/20"
            >
              Full page →
            </Link>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-card"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {error && (
            <div className="p-3 bg-error/10 border border-error/20 rounded-lg text-sm text-error">
              {error}
            </div>
          )}

          {data && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-1 leading-snug">
                  {data.agent.name}
                </h3>
                {data.agent.subtitle && (
                  <p className="text-xs text-muted font-mono mt-1">{data.agent.subtitle}</p>
                )}
                <div className="flex items-center gap-2 mt-3">
                  <StatusBadge status={data.agent.status} />
                  <span className="text-xs text-muted">
                    in <span className="text-foreground/70">{data.agent.project}</span>
                  </span>
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-card border border-card-border text-muted">
                    {data.agent.mode}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Lines Added" value={`+${data.agent.linesAdded}`} variant="green" />
                <StatCard label="Lines Removed" value={`-${data.agent.linesRemoved}`} variant="red" />
                <StatCard label="Files Changed" value={data.agent.filesChanged.toString()} />
                <StatCard label="Context" value={`${data.agent.contextUsage.toFixed(0)}%`} />
                <StatCard label="Turns" value={data.agent.turns.toString()} />
                <StatCard label="Subagents" value={data.agent.numSubComposers.toString()} />
                <StatCard
                  label="Created"
                  value={new Date(data.agent.createdAt).toLocaleDateString()}
                />
                <StatCard
                  label="Last Active"
                  value={new Date(data.agent.lastModified).toLocaleDateString()}
                />
              </div>

              <div className="flex gap-1 rounded-lg border border-card-border bg-card p-0.5">
                <button
                  type="button"
                  onClick={() => setPanelTab("transcript")}
                  className={`flex-1 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                    panelTab === "transcript" ? "bg-accent text-white" : "text-muted hover:text-foreground"
                  }`}
                >
                  Transcript
                </button>
                <button
                  type="button"
                  onClick={() => setPanelTab("traces")}
                  className={`flex-1 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                    panelTab === "traces" ? "bg-accent text-white" : "text-muted hover:text-foreground"
                  }`}
                >
                  Related traces
                  {relatedTraces.length > 0 ? (
                    <span className="ml-1.5 rounded-full bg-background/30 px-1.5 py-0.5 text-[10px]">
                      {relatedTraces.length}
                    </span>
                  ) : null}
                </button>
              </div>

              {panelTab === "transcript" && (
              <>
              {data.conversation.length > 0 ? (
                <div className="pt-2 -mx-1">
                  <TraceView
                    entries={data.conversation}
                    caption={`Showing ${data.conversation.length} of ${data.totalEntries} entries (most recent first).`}
                  />
                  {data.hasMore && (
                    <div className="flex items-center justify-center pt-4 pb-2 pl-14">
                      <button
                        onClick={loadMore}
                        disabled={loadingMore}
                        className="flex items-center gap-2 px-5 py-2.5 bg-card border border-card-border rounded-lg text-sm font-medium hover:border-accent hover:text-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loadingMore ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                            Loading...
                          </>
                        ) : (
                          <>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M12 5v14M5 12l7 7 7-7" />
                            </svg>
                            Load More ({data.conversation.length} of {data.totalEntries})
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="border border-dashed border-card-border rounded-xl p-8 text-center">
                  <p className="text-sm text-muted">No transcript data available for this agent.</p>
                </div>
              )}
              </>
              )}

              {panelTab === "traces" && (
                <div className="space-y-3 pt-1">
                  <p className="text-xs leading-relaxed text-muted">
                    Session traces aligned with this agent in time and workspace. Use the full page for a large DAG and file roll-up — or open in Trace Explorer.
                  </p>
                  {tracesLoading ? (
                    <div className="flex justify-center py-8">
                      <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : relatedTraces.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-card-border bg-card/40 px-4 py-8 text-center text-sm text-muted">
                      No overlapping traces found for this agent in the current project.
                    </div>
                  ) : (
                    <ul className="space-y-3">
                      {relatedTraces.map((t) => (
                        <li
                          key={t.session_id}
                          className="rounded-xl border border-card-border bg-card overflow-hidden"
                        >
                          <div className="p-4 flex flex-col sm:flex-row sm:items-start gap-3">
                            <div className="min-w-0 flex-1 space-y-1">
                              <p className="text-sm font-medium leading-snug line-clamp-3">{t.task}</p>
                              <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
                                <span className="font-mono">{t.session_id}</span>
                                <span>{t.event_count} steps</span>
                                <OutcomePill outcome={t.outcome} />
                              </div>
                              <time className="block text-[10px] text-muted/80 font-mono">
                                {parseTraceInstant(t.started_at).toLocaleString(undefined, {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                })}
                              </time>
                            </div>
                            <div className="flex flex-wrap gap-2 shrink-0">
                              <Link
                                href={`/agent/${agentId}?tab=dag&session=${encodeURIComponent(t.session_id)}`}
                                className="rounded-lg border border-card-border px-3 py-1.5 text-xs font-medium transition-colors hover:border-accent hover:text-accent"
                              >
                                DAG (full page)
                              </Link>
                              <Link
                                href={`/traces?session=${encodeURIComponent(t.session_id)}`}
                                className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
                              >
                                Open in traces
                              </Link>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="pt-2 border-t border-card-border">
                <p className="text-[11px] text-muted font-mono break-all">
                  ID: {data.agent.id}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, variant }: { label: string; value: string; variant?: "green" | "red" }) {
  const valColor = variant === "green" ? "text-finished" : variant === "red" ? "text-error" : "";
  return (
    <div className="bg-card border border-card-border rounded-lg p-3">
      <dt className="text-[11px] text-muted uppercase tracking-wider mb-0.5">{label}</dt>
      <dd className={`text-sm font-medium ${valColor}`}>{value}</dd>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-finished/15 text-finished border-finished/20",
    recent: "bg-accent/15 text-accent border-accent/20",
    idle: "bg-running/15 text-running border-running/20",
    old: "bg-muted/15 text-muted border-muted/20",
  };

  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium border ${styles[status] || styles.old}`}>
      {status}
    </span>
  );
}

function OutcomePill({ outcome }: { outcome: string }) {
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
