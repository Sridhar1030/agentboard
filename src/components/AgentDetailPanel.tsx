"use client";

import { useEffect, useState } from "react";
import type { AgentInfo, ConversationEntry } from "@/app/page";
import { TraceView } from "@/components/TraceView";

interface AgentDetailPanelProps {
  agentId: string;
  onClose: () => void;
}

interface AgentDetail {
  agent: AgentInfo;
  conversation: ConversationEntry[];
}

export function AgentDetailPanel({ agentId, onClose }: AgentDetailPanelProps) {
  const [data, setData] = useState<AgentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDetail() {
      try {
        const res = await fetch(`/api/agents/${agentId}`);
        const json = await res.json();
        if (json.error) {
          setError(json.error);
        } else {
          setData(json);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchDetail();
  }, [agentId]);

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
        <div className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-card-border px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-base font-semibold truncate">Agent Details</h2>
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

              {data.conversation.length > 0 ? (
                <div className="pt-2 -mx-1">
                  <TraceView
                    entries={data.conversation}
                    caption={`First ${data.conversation.length} of ${data.agent.turns} transcript lines.`}
                  />
                </div>
              ) : (
                <div className="border border-dashed border-card-border rounded-xl p-8 text-center">
                  <p className="text-sm text-muted">No transcript data available for this agent.</p>
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
