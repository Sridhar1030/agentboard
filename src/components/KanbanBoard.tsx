"use client";

import { AgentInfo } from "@/app/page";
import { AgentCard } from "./AgentCard";

interface KanbanBoardProps {
  agents: AgentInfo[];
  onSelect: (agentId: string) => void;
}

const columns = [
  {
    key: "active" as const,
    label: "Active",
    description: "Modified in the last hour",
    color: "#10b981",
  },
  {
    key: "recent" as const,
    label: "Today",
    description: "Modified today",
    color: "#6366f1",
  },
  {
    key: "idle" as const,
    label: "This Week",
    description: "Modified this week",
    color: "#f59e0b",
  },
  {
    key: "old" as const,
    label: "Older",
    description: "Over a week ago",
    color: "#71717a",
  },
];

export function KanbanBoard({ agents, onSelect }: KanbanBoardProps) {
  const grouped: Record<string, AgentInfo[]> = {
    active: agents.filter((a) => a.status === "active"),
    recent: agents.filter((a) => a.status === "recent"),
    idle: agents.filter((a) => a.status === "idle"),
    old: agents.filter((a) => a.status === "old"),
  };

  if (agents.length === 0) {
    return (
      <div className="flex items-center justify-center h-full px-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-card border border-card-border flex items-center justify-center mx-auto mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </div>
          <h2 className="text-lg font-medium mb-2">No agents found</h2>
          <p className="text-sm text-muted leading-relaxed">
            No matching agents. Try adjusting your search or showing archived agents.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-x-auto p-6">
      <div className="flex gap-5 h-full">
        {columns.map((col) => {
          const items = grouped[col.key];
          return (
            <div key={col.key} className="flex-1 min-w-[320px] flex flex-col">
              <div className="flex items-center gap-2 mb-1 px-1">
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: col.color }}
                />
                <h3 className="text-sm font-medium">{col.label}</h3>
                <span className="text-xs text-muted bg-card border border-card-border px-2 py-0.5 rounded-full">
                  {items.length}
                </span>
              </div>
              <p className="text-[11px] text-muted mb-3 px-1">{col.description}</p>
              <div className="flex-1 space-y-2.5 overflow-y-auto pb-4 pr-1 scrollbar-thin">
                {items.length === 0 ? (
                  <div className="flex items-center justify-center h-24 border border-dashed border-card-border rounded-xl">
                    <p className="text-xs text-muted">None</p>
                  </div>
                ) : (
                  items.map((agent) => (
                    <AgentCard
                      key={agent.id}
                      agent={agent}
                      color={col.color}
                      onClick={() => onSelect(agent.id)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
