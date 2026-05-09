"use client";

import { AgentInfo } from "@/app/page";

interface StatsBannerProps {
  agents: AgentInfo[];
  traceCount: number;
}

export function StatsBanner({ agents, traceCount }: StatsBannerProps) {
  const totalLines = agents.reduce((s, a) => s + a.linesAdded + a.linesRemoved, 0);
  const totalFilesChanged = agents.reduce((s, a) => s + a.filesChanged, 0);
  const avgContext = agents.filter((a) => a.contextUsage > 0);
  const avgContextPct = avgContext.length > 0
    ? avgContext.reduce((s, a) => s + a.contextUsage, 0) / avgContext.length
    : 0;
  const totalTurns = agents.reduce((s, a) => s + a.turns, 0);
  const agentMode = agents.filter((a) => a.mode === "agent" || a.mode === "multitask").length;

  const stats = [
    { label: "Agent Sessions", value: agents.length.toString(), icon: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" },
    { label: "Lines Touched", value: totalLines > 1000 ? `${(totalLines / 1000).toFixed(1)}k` : totalLines.toString(), icon: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8" },
    { label: "Files Changed", value: totalFilesChanged.toString(), icon: "M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM13 2v7h7" },
    { label: "Traces Captured", value: traceCount.toString(), icon: "M22 12h-4l-3 9L9 3l-3 9H2" },
    { label: "Avg Context", value: `${avgContextPct.toFixed(0)}%`, icon: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM12 8v4l2 2" },
    { label: "Agent Mode", value: `${agentMode}/${agents.length}`, icon: "M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 px-6 py-4 border-b border-card-border bg-card/30">
      {stats.map((stat) => (
        <div key={stat.label} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-background/50 border border-card-border">
          <div className="shrink-0 w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent">
              <path d={stat.icon} />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold tabular-nums">{stat.value}</div>
            <div className="text-[10px] text-muted truncate">{stat.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
