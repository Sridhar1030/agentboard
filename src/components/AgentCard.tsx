"use client";

import { AgentInfo } from "@/app/page";

interface AgentCardProps {
  agent: AgentInfo;
  color: string;
  onClick: () => void;
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

export function AgentCard({ agent, color, onClick }: AgentCardProps) {
  const hasChanges = agent.linesAdded > 0 || agent.linesRemoved > 0;

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 bg-card border border-card-border rounded-xl hover:border-accent/50 transition-all duration-150 hover:shadow-lg hover:shadow-accent/5 slide-up group"
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <h4 className="text-sm font-medium leading-snug group-hover:text-accent-hover transition-colors line-clamp-2">
          {agent.name}
        </h4>
        {agent.status === "active" && (
          <div className="w-2 h-2 rounded-full shrink-0 mt-1.5 pulse-dot" style={{ backgroundColor: color }} />
        )}
      </div>

      {agent.subtitle && (
        <p className="text-[11px] text-muted line-clamp-1 mb-2.5 font-mono">
          {agent.subtitle}
        </p>
      )}

      <div className="flex items-center gap-2 mb-2.5 flex-wrap">
        <span className="inline-flex items-center gap-1 text-[11px] text-muted px-1.5 py-0.5 bg-background rounded border border-card-border">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 3h18v18H3z" />
            <path d="M3 9h18" />
            <path d="M9 21V9" />
          </svg>
          {agent.project}
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] text-muted px-1.5 py-0.5 bg-background rounded border border-card-border">
          {agent.mode}
        </span>
      </div>

      <div className="flex items-center justify-between text-[11px] text-muted">
        <div className="flex items-center gap-3">
          {hasChanges && (
            <span className="flex items-center gap-1">
              <span className="text-finished">+{agent.linesAdded}</span>
              <span className="text-error">-{agent.linesRemoved}</span>
            </span>
          )}
          {agent.filesChanged > 0 && (
            <span className="flex items-center gap-1">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
              </svg>
              {agent.filesChanged}
            </span>
          )}
          {agent.turns > 0 && (
            <span className="flex items-center gap-1">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              {agent.turns}
            </span>
          )}
          {agent.numSubComposers > 0 && (
            <span className="flex items-center gap-1">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83" />
              </svg>
              {agent.numSubComposers}
            </span>
          )}
        </div>
        <span>{timeAgo(agent.lastModified)}</span>
      </div>
    </button>
  );
}
