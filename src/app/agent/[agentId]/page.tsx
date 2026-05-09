"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import type { AgentInfo, ConversationEntry } from "@/app/page";
import { COACH_ANALYSIS_USER_WINDOW } from "@/lib/promptCoachConstants";
import type { CoachApiResponse, CoachGrade } from "@/lib/promptCoach";
import { TraceView } from "@/components/TraceView";
import { TraceDagSvg, type DagTraceEvent } from "@/components/TraceDagSvg";
import { parseTraceInstant, traceRelatesToAgent, type TraceSessionRow } from "@/lib/agentTraceMatch";

const PAGE_SIZE = 50;

interface AgentDetail {
  agent: AgentInfo;
  conversation: ConversationEntry[];
  totalEntries: number;
  hasMore: boolean;
}

type TabId = "activity" | "dag" | "files" | "coach";

export default function AgentSessionPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const agentId = typeof params.agentId === "string" ? params.agentId : "";

  if (!agentId) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center p-6">
        <p className="text-sm text-muted">Invalid agent id.</p>
      </main>
    );
  }

  return <AgentSessionContent key={agentId} agentId={agentId} searchParams={searchParams} />;
}

function AgentSessionContent({
  agentId,
  searchParams,
}: {
  agentId: string;
  searchParams: ReturnType<typeof useSearchParams>;
}) {

  const [data, setData] = useState<AgentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("activity");

  const [traceSessions, setTraceSessions] = useState<TraceSessionRow[]>([]);
  const [dagSessionId, setDagSessionId] = useState<string | null>(null);
  const [dagEvents, setDagEvents] = useState<DagTraceEvent[]>([]);
  const [dagLoading, setDagLoading] = useState(false);
  const [dagStepFocus, setDagStepFocus] = useState<string | null>(null);

  const [coach, setCoach] = useState<CoachApiResponse | null>(null);
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachErr, setCoachErr] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!agentId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/agents/${agentId}?offset=0&limit=${PAGE_SIZE}`);
        const json = await res.json();
        if (json.error) setError(json.error);
        else setData(json);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [agentId]);

  const fetchCoach = useCallback(
    async (force: boolean) => {
      if (!agentId) return;
      setCoachLoading(true);
      setCoachErr(null);
      try {
        const q = force ? "?force=true" : "";
        const res = await fetch(`/api/agents/${encodeURIComponent(agentId)}/coach${q}`);
        const json = (await res.json()) as Record<string, unknown>;
        if (!("grade" in json) && typeof json.error === "string") {
          setCoachErr(json.error);
          if (!force) setCoach(null);
          return;
        }
        setCoach(json as unknown as CoachApiResponse);
      } catch (e: unknown) {
        setCoachErr(e instanceof Error ? e.message : "Could not load Prompt Coach.");
        if (!force) setCoach(null);
      } finally {
        setCoachLoading(false);
      }
    },
    [agentId]
  );

  useEffect(() => {
    if (tab !== "coach" || !agentId) return;
    if (coach !== null || coachErr !== null || coachLoading) return;
    queueMicrotask(() => void fetchCoach(false));
  }, [tab, agentId, coach, coachErr, coachLoading, fetchCoach]);

  useEffect(() => {
    fetch("/api/traces")
      .then((r) => r.json())
      .then((d) => setTraceSessions((d.sessions || []) as TraceSessionRow[]))
      .catch(() => setTraceSessions([]));
  }, [agentId]);

  const relatedTraces = useMemo(() => {
    if (!data?.agent) return [];
    return traceSessions
      .filter((t) => traceRelatesToAgent(t, data.agent))
      .sort((a, b) => parseTraceInstant(b.started_at).getTime() - parseTraceInstant(a.started_at).getTime());
  }, [data, traceSessions]);

  useEffect(() => {
    queueMicrotask(() => {
      const t = searchParams.get("tab");
      if (t === "dag" || t === "files" || t === "activity" || t === "coach") setTab(t);
    });
  }, [searchParams]);

  useEffect(() => {
    queueMicrotask(() => {
      const fromUrl = searchParams.get("session");
      if (fromUrl && relatedTraces.some((r) => r.session_id === fromUrl)) {
        setDagSessionId(fromUrl);
        return;
      }
      if (relatedTraces.length === 0) {
        setDagSessionId(null);
        return;
      }
      setDagSessionId((cur) => {
        if (cur && relatedTraces.some((x) => x.session_id === cur)) return cur;
        return relatedTraces[0]!.session_id;
      });
    });
  }, [relatedTraces, searchParams]);

  const loadDag = useCallback(async (sessionId: string) => {
    setDagLoading(true);
    setDagStepFocus(null);
    try {
      const res = await fetch(`/api/traces/${sessionId}`);
      const d = await res.json();
      if (!d.error && d.events) setDagEvents(d.events as DagTraceEvent[]);
      else setDagEvents([]);
    } catch {
      setDagEvents([]);
    } finally {
      setDagLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab !== "dag" || !dagSessionId) return;
    queueMicrotask(() => void loadDag(dagSessionId));
  }, [tab, dagSessionId, loadDag]);

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
    } catch {
      // ignore
    } finally {
      setLoadingMore(false);
    }
  }, [agentId, data, loadingMore]);

  const fileRows = useMemo(() => aggregateFileTouches(data?.conversation || []), [data]);

  return (
    <main className="flex min-h-[100dvh] flex-col overflow-hidden bg-background">
      <header className="shrink-0 border-b border-card-border px-6 py-4">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/"
              className="shrink-0 text-muted transition hover:text-foreground"
              title="Back to board"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold tracking-tight">
                {loading ? "Loading…" : data?.agent.name ?? "Agent"}
              </h1>
              {!loading && data?.agent.subtitle && (
                <p className="mt-0.5 truncate font-mono text-[11px] text-muted">{data.agent.subtitle}</p>
              )}
            </div>
          </div>
          {data && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <StatusBadge status={data.agent.status} />
              <span className="rounded border border-card-border bg-card px-2 py-1 font-mono text-[10px] text-foreground/80">
                {data.agent.id}
              </span>
            </div>
          )}
        </div>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col gap-6 px-6 py-6 lg:flex-row">
        {/* Metadata column */}
        <aside className="flex w-full shrink-0 flex-col gap-4 lg:w-[300px]">
          {loading && (
            <div className="flex justify-center py-16">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            </div>
          )}
          {error && (
            <div className="rounded-lg border border-error/20 bg-error/10 p-4 text-sm text-error">{error}</div>
          )}
          {data && (
            <MetadataCard agent={data.agent} createdLabel={formatRange(data.agent)} />
          )}
        </aside>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-card-border bg-card/30">
          {data && (
            <>
              <div className="shrink-0 border-b border-card-border bg-background/60 px-4 py-3 backdrop-blur-sm">
                <nav className="flex flex-wrap gap-1" aria-label="Agent session">
                  <TabButton active={tab === "activity"} onClick={() => setTab("activity")}>
                    Activity
                  </TabButton>
                  <TabButton active={tab === "dag"} onClick={() => setTab("dag")}>
                    Reasoning DAG
                    {relatedTraces.length > 0 ? (
                      <span className="ml-1 rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                        {relatedTraces.length}
                      </span>
                    ) : null}
                  </TabButton>
                  <TabButton active={tab === "files"} onClick={() => setTab("files")}>
                    Files
                  </TabButton>
                  <TabButton active={tab === "coach"} onClick={() => setTab("coach")}>
                    Prompt Coach
                  </TabButton>
                </nav>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                {tab === "activity" && (
                  <div className="p-4 sm:p-6 lg:p-8">
                    {data.conversation.length > 0 ? (
                      <>
                        <TraceView
                          entries={data.conversation}
                          density="comfortable"
                          caption={`Showing ${data.conversation.length} of ${data.totalEntries} entries.`}
                        />
                        {data.hasMore && (
                          <div className="mt-10 flex justify-center">
                            <button
                              type="button"
                              onClick={() => void loadMore()}
                              disabled={loadingMore}
                              className="inline-flex items-center gap-2 rounded-lg border border-card-border bg-card px-5 py-2.5 text-sm font-medium transition hover:border-accent hover:text-accent disabled:opacity-50"
                            >
                              {loadingMore ? (
                                <>
                                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                                  Loading…
                                </>
                              ) : (
                                "Load more transcript"
                              )}
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="rounded-xl border border-dashed border-card-border py-16 text-center text-sm text-muted">
                        No transcript for this agent.
                      </div>
                    )}
                  </div>
                )}

                {tab === "dag" && (
                  <div className="flex h-full min-h-[520px] flex-col gap-3 p-4 sm:p-5">
                    {relatedTraces.length === 0 ? (
                      <p className="text-sm text-muted">
                        No overlapping session traces for this workspace yet. Capture traces with the session tracer MCP, or open the{" "}
                        <Link href="/traces" className="text-accent underline-offset-2 hover:underline">
                          Trace Explorer
                        </Link>
                        .
                      </p>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center gap-2">
                          <label htmlFor="dag-session" className="text-[11px] font-medium uppercase tracking-wider text-muted">
                            Session
                          </label>
                          <select
                            id="dag-session"
                            value={dagSessionId || ""}
                            onChange={(e) => setDagSessionId(e.target.value || null)}
                            className="min-w-0 flex-1 rounded-lg border border-card-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none sm:max-w-lg"
                          >
                            {relatedTraces.map((t) => (
                              <option key={t.session_id} value={t.session_id}>
                                {t.task.slice(0, 80)}
                                {t.task.length > 80 ? "…" : ""} — {t.event_count} steps
                              </option>
                            ))}
                          </select>
                          {dagSessionId && (
                            <Link
                              href={`/traces?session=${encodeURIComponent(dagSessionId)}`}
                              className="shrink-0 rounded-lg border border-card-border px-3 py-2 text-xs font-medium text-muted transition hover:border-accent hover:text-accent"
                            >
                              Open in traces
                            </Link>
                          )}
                        </div>
                        {dagLoading ? (
                          <div className="flex flex-1 items-center justify-center py-24">
                            <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                          </div>
                        ) : dagSessionId ? (
                          <TraceDagSvg
                            className="min-h-[480px] flex-1"
                            events={dagEvents}
                            sessionId={dagSessionId}
                            expandedStep={dagStepFocus}
                            onToggle={setDagStepFocus}
                          />
                        ) : null}
                      </>
                    )}
                  </div>
                )}

                {tab === "files" && (
                  <div className="p-4 sm:p-6 lg:p-8">
                    <FilesTab agent={data.agent} rows={fileRows} />
                  </div>
                )}

                {tab === "coach" && (
                  <div className="p-4 sm:p-6 lg:p-8">
                    <PromptCoachPanel
                      coach={coach}
                      loading={coachLoading}
                      error={coachErr}
                      agentHasTranscript={data.agent.hasTranscript}
                      loadCoach={fetchCoach}
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function PromptCoachPanel({
  coach,
  loading,
  error,
  agentHasTranscript,
  loadCoach,
}: {
  coach: CoachApiResponse | null;
  loading: boolean;
  error: string | null;
  agentHasTranscript: boolean;
  loadCoach: (force: boolean) => void | Promise<void>;
}) {
  if (loading && !coach) {
    return (
      <div className="flex justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  if (error && !coach) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-card-border bg-background/60 p-8 text-center text-sm text-muted">{error}</div>
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => void loadCoach(false)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-card-border bg-card px-4 py-2 text-xs font-medium text-foreground transition hover:border-accent hover:text-accent disabled:opacity-50"
          >
            {loading ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                Retrying…
              </>
            ) : (
              "Try again"
            )}
          </button>
        </div>
      </div>
    );
  }

  if (!coach) {
    return null;
  }

  if (coach.totalTurns === 0) {
    return (
      <div className="rounded-xl border border-dashed border-card-border py-14 text-center text-sm text-muted">
        {agentHasTranscript ? "No user messages found to analyze in this transcript." : "No transcript on disk for this agent yet."}
      </div>
    );
  }

  const productivePct = Math.round(coach.efficiency * 100);
  const wastedPct = Math.max(0, 100 - productivePct);

  return (
    <div className="slide-up space-y-6">
      {error && (
        <div className="rounded-lg border border-error/25 bg-error/10 px-4 py-3 text-sm text-error">{error}</div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Prompt Coach</h2>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted">
            A quick read on prompt clarity based on your transcript — heuristic signals plus an optional Cursor API pass
            when a key is configured. Analysis loads when you open this tab; the server caches results until the
            transcript file changes.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-start">
          <button
            type="button"
            onClick={() => void loadCoach(true)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-card-border bg-card px-3 py-2 text-xs font-medium text-foreground transition hover:border-accent hover:text-accent disabled:opacity-50"
          >
            {loading ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                Refreshing…
              </>
            ) : (
              "Refresh analysis"
            )}
          </button>
          <div
            className={`flex h-20 min-w-[5.5rem] flex-col items-center justify-center rounded-2xl border-2 px-6 ${gradeCardClass(coach.grade)}`}
            title="Letter grade for clarity / specificity"
          >
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted/90">Grade</span>
            <span className="text-4xl font-black tabular-nums tracking-tight">{coach.grade}</span>
          </div>
        </div>
      </div>

      {coach.sdkCoachAttempted && (
        <p className="text-[11px] text-muted">
          {coach.sdkCoachSucceeded ? (
            <span className="text-finished/90">Narrative coaching was refined with the Cursor API.</span>
          ) : (
            <span>Showing heuristic coaching only — the Cursor API did not return usable JSON (or the key is missing).</span>
          )}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-card-border bg-card/60 p-5 shadow-sm">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">Efficiency</h3>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
            {productivePct}
            <span className="text-base font-medium text-muted">%</span>
            <span className="ml-2 text-xs font-normal text-muted">productive turns</span>
          </p>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-background/80">
            <div
              className="h-full rounded-full bg-gradient-to-r from-finished to-emerald-600/90 transition-[width] duration-700 ease-out"
              style={{ width: `${productivePct}%` }}
            />
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
            <div>
              <dt className="text-muted">Productive turns</dt>
              <dd className="mt-0.5 font-mono tabular-nums text-foreground">{coach.productiveTurns}</dd>
            </div>
            <div>
              <dt className="text-muted">Refinement turns</dt>
              <dd className="mt-0.5 font-mono tabular-nums text-amber-200/90">{coach.wastedTurns}</dd>
            </div>
            <div>
              <dt className="text-muted">Total user turns</dt>
              <dd className="mt-0.5 font-mono tabular-nums text-foreground">{coach.totalTurns}</dd>
            </div>
            <div>
              <dt className="text-muted">Avg words / turn</dt>
              <dd className="mt-0.5 font-mono tabular-nums text-foreground">{coach.avgWordsPerMessage.toFixed(0)}</dd>
            </div>
          </dl>
          {coach.totalTurns > COACH_ANALYSIS_USER_WINDOW && (
            <p className="mt-3 text-[10px] leading-snug text-muted">
              Productive and refinement counts are for the last {COACH_ANALYSIS_USER_WINDOW} user messages (efficiency bar
              matches that window).
            </p>
          )}
          {wastedPct > 0 && (
            <p className="mt-3 text-[11px] leading-relaxed text-muted">
              About <span className="font-medium text-foreground/90">{wastedPct}%</span> of turns looked like refinements or
              corrections — next time, folding those details into the first prompt can save back-and-forth.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-card-border bg-card/60 p-5 shadow-sm">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">Summary</h3>
          <p className="mt-2 text-sm leading-relaxed text-foreground/90">{coach.summary}</p>
        </div>
      </div>

      <div className="rounded-xl border border-card-border bg-background/50 p-5">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">What you could have said in one go</h3>
        <blockquote className="mt-3 border-l-4 border-accent/70 pl-4 text-sm leading-relaxed text-foreground/92">
          {coach.idealPrompt}
        </blockquote>
      </div>

      <div className="rounded-xl border border-card-border bg-card/40 p-5">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">Tips for next time</h3>
        <ul className="mt-4 space-y-3">
          {coach.tips.map((tip, i) => (
            <li key={i} className="flex gap-3 text-sm leading-relaxed text-foreground/90">
              <span
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent"
                aria-hidden
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 18v-2M9 21h6M12 3a6 6 0 016 6c0 2.5-1.5 4.5-3 6H9c-1.5-1.5-3-3.5-3-6a6 6 0 016-6z" />
                </svg>
              </span>
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </div>

      {coach.correctionMoments.length > 0 && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-5">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-amber-200/90">Correction-style moments</h3>
          <p className="mt-1 text-[11px] text-muted">
            These messages matched correction or tight follow-up patterns — not a judgment on quality, just a signal for
            where prompts could be richer earlier.
          </p>
          <ul className="mt-4 space-y-3">
            {coach.correctionMoments.map((m) => (
              <li
                key={m.turnIndex}
                className="rounded-lg border border-card-border bg-background/40 px-4 py-3 text-sm"
              >
                <div className="flex flex-wrap items-baseline gap-2 text-[10px] uppercase tracking-wide text-muted">
                  <span>Turn {m.turnIndex + 1}</span>
                  <span className="text-muted/80">— {m.reason}</span>
                </div>
                <p className="mt-2 font-mono text-[13px] leading-relaxed text-foreground/88">{m.text}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function gradeCardClass(grade: CoachGrade): string {
  const styles: Record<CoachGrade, string> = {
    A: "border-emerald-500/45 bg-emerald-500/10",
    B: "border-sky-500/45 bg-sky-500/10",
    C: "border-amber-500/45 bg-amber-500/10",
    D: "border-red-500/45 bg-red-500/10",
  };
  return styles[grade] ?? styles.D;
}

function TabButton({
  children,
  active,
  onClick,
}: {
  children: ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
        active ? "bg-accent text-white shadow-sm" : "text-muted hover:bg-card hover:text-foreground"
      }`}
    >
      {children}
    </button>
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
    <span
      className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${styles[status] || styles.old}`}
    >
      {status}
    </span>
  );
}

function formatRange(agent: AgentInfo): string {
  const a = new Date(agent.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  const b = new Date(agent.lastModified).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  return `${a} → ${b}`;
}

function MetadataCard({ agent, createdLabel }: { agent: AgentInfo; createdLabel: string }) {
  return (
    <div className="space-y-4 rounded-xl border border-card-border bg-card/80 p-5 shadow-sm">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Project</p>
        <p className="mt-1 text-sm font-medium leading-snug">{agent.project}</p>
        <p className="mt-1 font-mono text-[10px] text-muted/90 line-clamp-2 break-all" title={agent.workspace || agent.projectPath}>
          {(agent.workspace || agent.projectPath || "").replace(/^\/Users\/[^/]+/, "~") || "—"}
        </p>
      </div>
      <dl className="space-y-3 text-sm">
        <div className="flex justify-between gap-2">
          <dt className="text-muted">Mode</dt>
          <dd className="font-medium">{agent.mode}</dd>
        </div>
        <div>
          <dt className="text-muted">Activity window</dt>
          <dd className="mt-0.5 text-[11px] leading-relaxed text-foreground/85">{createdLabel}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted">Lines Δ</dt>
          <dd>
            <span className="text-finished">+{agent.linesAdded}</span>
            <span className="text-muted"> / </span>
            <span className="text-error">−{agent.linesRemoved}</span>
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted">Files changed</dt>
          <dd className="font-medium tabular-nums">{agent.filesChanged}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted">Context</dt>
          <dd className="font-medium tabular-nums">{agent.contextUsage.toFixed(0)}%</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted">Turns</dt>
          <dd className="tabular-nums">{agent.turns}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted">Subagents</dt>
          <dd className="tabular-nums">{agent.numSubComposers}</dd>
        </div>
        <div className="flex justify-between gap-2 border-t border-card-border pt-3">
          <dt className="text-muted">Transcript</dt>
          <dd>{agent.hasTranscript ? "Available" : "None"}</dd>
        </div>
      </dl>
    </div>
  );
}

function aggregateFileTouches(entries: ConversationEntry[]): { path: string; reads: number; writes: number }[] {
  const m = new Map<string, { reads: number; writes: number }>();
  for (const e of entries) {
    for (const f of e.filesTouched || []) {
      const cur = m.get(f.path) || { reads: 0, writes: 0 };
      if (f.op === "read") cur.reads++;
      else cur.writes++;
      m.set(f.path, cur);
    }
  }
  return [...m.entries()]
    .map(([path, c]) => ({ path, ...c }))
    .sort((a, b) => b.reads + b.writes - (a.reads + a.writes));
}

function FilesTab({
  agent,
  rows,
}: {
  agent: AgentInfo;
  rows: { path: string; reads: number; writes: number }[];
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold">Workspace diff</h2>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted">
          Roll-up from agent metrics (not per-file line counts). Transcript-derived file touches are listed below when
          present.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border border-card-border bg-background/60 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-muted">Lines added</div>
            <div className="text-lg font-semibold text-finished">+{agent.linesAdded}</div>
          </div>
          <div className="rounded-lg border border-card-border bg-background/60 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-muted">Lines removed</div>
            <div className="text-lg font-semibold text-error">−{agent.linesRemoved}</div>
          </div>
          <div className="rounded-lg border border-card-border bg-background/60 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-muted">Files touched</div>
            <div className="text-lg font-semibold tabular-nums">{agent.filesChanged}</div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">From transcript (read/write)</h3>
        {rows.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No file paths parsed in the loaded transcript window.</p>
        ) : (
          <ul className="mt-3 divide-y divide-card-border rounded-xl border border-card-border">
            {rows.map((r) => (
              <li key={r.path} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-sm">
                <span className="min-w-0 break-all font-mono text-[13px] text-foreground/90">{r.path}</span>
                <span className="shrink-0 font-mono text-xs text-muted">
                  <span className="text-emerald-400/90">+R {r.reads}</span>
                  <span className="mx-1.5 text-card-border">·</span>
                  <span className="text-amber-300/90">+W {r.writes}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
