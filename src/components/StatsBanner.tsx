"use client";

import Link from "next/link";
import { AgentInfo } from "@/app/page";

interface StatsBannerProps {
  agents: AgentInfo[];
  traceCount: number;
  totalAgents: number;
}

export function StatsBanner({ agents, traceCount, totalAgents }: StatsBannerProps) {
  const totalLines = agents.reduce((s, a) => s + a.linesAdded + a.linesRemoved, 0);
  const totalFilesChanged = agents.reduce((s, a) => s + a.filesChanged, 0);
  const avgContext = agents.filter((a) => a.contextUsage > 0);
  const avgContextPct = avgContext.length > 0
    ? avgContext.reduce((s, a) => s + a.contextUsage, 0) / avgContext.length
    : 0;

  const modeAgent = agents.filter((a) => a.mode === "agent").length;
  const modeMultitask = agents.filter((a) => a.mode === "multitask").length;
  const modeChat = agents.filter((a) => a.mode === "chat" || a.mode === "plan").length;

  const stats = [
    {
      label: "Total Sessions",
      value: totalAgents.toString(),
      sublabel: `${agents.length} loaded`,
      icon: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
    },
    {
      label: "Lines Touched",
      value: totalLines > 1000 ? `${(totalLines / 1000).toFixed(1)}k` : totalLines.toString(),
      sublabel: "across loaded sessions",
      icon: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8",
    },
    {
      label: "Files Changed",
      value: totalFilesChanged.toString(),
      sublabel: "unique files",
      icon: "M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM13 2v7h7",
    },
    {
      label: "Avg Context",
      value: `${avgContextPct.toFixed(0)}%`,
      sublabel: "budget used per session",
      icon: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM12 8v4l2 2",
    },
    {
      label: "Mode Split",
      value: `${modeAgent}A / ${modeMultitask}M / ${modeChat}C`,
      sublabel: "Agent / Multi / Chat",
      icon: "M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M8.5 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM20 8v6M23 11h-6",
    },
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

      {/* Traces — clickable, links to /traces */}
      <Link
        href="/traces"
        className="flex items-center gap-3 px-3 py-2 rounded-lg bg-background/50 border border-card-border hover:border-accent/50 hover:bg-accent/5 transition-colors group"
      >
        <div className="shrink-0 w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold tabular-nums">{traceCount}</div>
          <div className="text-[10px] text-muted truncate group-hover:text-accent/70 transition-colors">Traces &rarr;</div>
        </div>
      </Link>
    </div>
  );
}
