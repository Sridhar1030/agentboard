"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { KanbanBoard } from "@/components/KanbanBoard";
import { AgentDetailPanel } from "@/components/AgentDetailPanel";
import { StatsBanner } from "@/components/StatsBanner";

export interface AgentInfo {
  id: string;
  name: string;
  subtitle: string;
  project: string;
  projectPath: string;
  workspace: string;
  lastModified: number;
  createdAt: number;
  mode: string;
  linesAdded: number;
  linesRemoved: number;
  filesChanged: number;
  contextUsage: number;
  isArchived: boolean;
  numSubComposers: number;
  status: "active" | "recent" | "idle" | "old";
  hasTranscript: boolean;
  turns: number;
}

export type {
  ConversationEntry,
  ConversationToolCall,
  FileTouch,
} from "@/types/conversation";

const PAGE_SIZE = 50;

export default function Home() {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [traceCount, setTraceCount] = useState(0);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [workspace, setWorkspace] = useState<string>("all");

  useEffect(() => {
    const saved = localStorage.getItem("agentboard-theme");
    if (saved === "light") {
      queueMicrotask(() => {
        setTheme("light");
        document.documentElement.classList.add("light");
      });
    }
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    if (next === "light") {
      document.documentElement.classList.add("light");
    } else {
      document.documentElement.classList.remove("light");
    }
    localStorage.setItem("agentboard-theme", next);
  }

  const fetchAgents = useCallback(async (reset = true) => {
    try {
      const res = await fetch(`/api/agents?offset=0&limit=${PAGE_SIZE}`);
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setAgents(data.agents);
        setHasMore(data.hasMore);
        setTotal(data.total);
        setError(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (reset) setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/agents?offset=${agents.length}&limit=${PAGE_SIZE}`);
      const data = await res.json();
      if (!data.error) {
        setAgents((prev) => [...prev, ...data.agents]);
        setHasMore(data.hasMore);
        setTotal(data.total);
      }
    } catch {} finally {
      setLoadingMore(false);
    }
  }, [agents.length, hasMore, loadingMore]);

  const fetchTraces = useCallback(async () => {
    try {
      const res = await fetch("/api/traces");
      const data = await res.json();
      setTraceCount(data.total || 0);
    } catch {}
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void fetchAgents();
      void fetchTraces();
    });
    const interval = setInterval(() => {
      void fetchAgents();
      void fetchTraces();
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchAgents, fetchTraces]);

  const workspaces = Array.from(new Set(agents.map((a) => a.project).filter(Boolean))).sort();

  const filtered = agents.filter((a) => {
    if (!showArchived && a.isArchived) return false;
    if (workspace !== "all" && a.project !== workspace) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      a.name.toLowerCase().includes(q) ||
      a.project.toLowerCase().includes(q) ||
      a.subtitle.toLowerCase().includes(q)
    );
  });

  const counts = {
    total: total || agents.filter((a) => !a.isArchived).length,
    active: agents.filter((a) => a.status === "active" && !a.isArchived).length,
    recent: agents.filter((a) => a.status === "recent" && !a.isArchived).length,
    idle: agents.filter((a) => a.status === "idle" && !a.isArchived).length,
  };

  return (
    <main className="flex-1 flex flex-col h-screen overflow-hidden">
      <header className="border-b border-card-border px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">AgentBoard</h1>
            {!loading && (
              <p className="text-xs text-muted">
                {counts.total} agents &middot; {counts.active} active &middot; {counts.recent} today &middot; {counts.idle} this week
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/insights"
            className="flex items-center gap-1.5 text-xs text-muted hover:text-accent transition-colors px-3 py-2 rounded-lg hover:bg-card border border-transparent hover:border-card-border"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2" />
            </svg>
            Insights
          </Link>
          <Link
            href="/traces"
            className="flex items-center gap-1.5 text-xs text-muted hover:text-accent transition-colors px-3 py-2 rounded-lg hover:bg-card border border-transparent hover:border-card-border"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
            Traces
            {traceCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-accent/15 text-accent text-[10px] font-semibold">
                {traceCount}
              </span>
            )}
          </Link>
          <button
            onClick={toggleTheme}
            className="text-muted hover:text-foreground transition-colors p-2 rounded-lg hover:bg-card"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
          <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded border-card-border"
            />
            Archived
          </label>
          <select
            value={workspace}
            onChange={(e) => setWorkspace(e.target.value)}
            className="bg-card border border-card-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent transition-colors appearance-none cursor-pointer max-w-[160px]"
            title="Filter by workspace"
          >
            <option value="all">All Workspaces</option>
            {workspaces.map((ws) => (
              <option key={ws} value={ws}>{ws}</option>
            ))}
          </select>
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search agents..."
              className="bg-card border border-card-border rounded-lg pl-9 pr-3 py-2 text-sm w-56 placeholder:text-muted/50 focus:outline-none focus:border-accent transition-colors"
            />
          </div>
          <button
            onClick={() => fetchAgents()}
            className="text-muted hover:text-foreground transition-colors p-2 rounded-lg hover:bg-card"
            title="Refresh"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 2v6h-6" />
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
              <path d="M3 22v-6h6" />
              <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
            </svg>
          </button>
        </div>
      </header>

      {!loading && <StatsBanner agents={filtered} traceCount={traceCount} totalAgents={total} />}

      {error && (
        <div className="mx-6 mt-4 p-3 bg-error/10 border border-error/20 rounded-lg text-sm text-error shrink-0">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3">
              <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-muted">Loading agents...</span>
            </div>
          </div>
        ) : (
          <KanbanBoard
            agents={filtered}
            onSelect={setSelectedAgent}
            hasMore={hasMore}
            loadingMore={loadingMore}
            onLoadMore={loadMore}
            total={total}
          />
        )}
      </div>

      {selectedAgent && (
        <AgentDetailPanel
          agentId={selectedAgent}
          onClose={() => setSelectedAgent(null)}
        />
      )}
    </main>
  );
}
