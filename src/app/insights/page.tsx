"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";

interface FileNode {
  id: string;
  name: string;
  touches: number;
  reads: number;
  writes: number;
  sessions: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
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
  topProjects: TopProject[];
  hottestSessions: HotSession[];
  totals: { totalSessions: number; totalLines: number; totalFiles: number; avgContext: number };
}

export default function InsightsPage() {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/insights")
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
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
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Insights</h1>
            <p className="text-xs text-muted">Cross-session intelligence &amp; file relationship graph</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
            <SummaryCard label="Total Sessions" value={data.totals.totalSessions.toString()} sublabel="across all projects" gradient="from-accent/20 to-accent/5" />
            <SummaryCard label="Lines Impacted" value={data.totals.totalLines > 1000 ? `${(data.totals.totalLines / 1000).toFixed(1)}k` : data.totals.totalLines.toString()} sublabel="added + removed" gradient="from-finished/20 to-finished/5" />
            <SummaryCard label="Files Touched" value={data.totals.totalFiles.toString()} sublabel="unique files modified" gradient="from-running/20 to-running/5" />
            <SummaryCard label="Avg Context" value={`${data.totals.avgContext.toFixed(0)}%`} sublabel="budget consumed/session" gradient="from-purple-500/20 to-purple-500/5" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
            {/* File Relationship Graph */}
            <div className="lg:col-span-2 bg-card border border-card-border rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-card-border flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold">File Relationship Graph</h2>
                  <p className="text-[11px] text-muted mt-0.5">Files modified together across sessions — thicker lines = stronger coupling</p>
                </div>
                <span className="text-[10px] text-muted bg-background px-2 py-1 rounded border border-card-border font-mono">
                  {data.graph.nodes.length} files &middot; {data.graph.edges.length} links
                </span>
              </div>
              <ForceGraph
                nodes={data.graph.nodes}
                edges={data.graph.edges}
                hoveredNode={hoveredNode}
                onHover={setHoveredNode}
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

          {/* File Heatmap from graph */}
          {data.graph.nodes.length > 0 && (
            <div className="px-6 pb-6">
              <div className="bg-card border border-card-border rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-card-border">
                  <h2 className="text-sm font-semibold">File Touch Frequency</h2>
                  <p className="text-[11px] text-muted mt-0.5">Which files AI agents interact with most (from traced sessions)</p>
                </div>
                <div className="p-4">
                  <div className="flex flex-wrap gap-2">
                    {data.graph.nodes.slice(0, 30).map((node) => (
                      <FileChip key={node.id} node={node} maxTouches={data.graph.nodes[0]?.touches || 1} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </main>
  );
}

function ForceGraph({
  nodes,
  edges,
  hoveredNode,
  onHover,
}: {
  nodes: FileNode[];
  edges: FileEdge[];
  hoveredNode: string | null;
  onHover: (id: string | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const nodesRef = useRef<FileNode[]>([]);
  const [dimensions, setDimensions] = useState({ w: 800, h: 500 });

  const initNodes = useCallback(() => {
    const w = dimensions.w;
    const h = dimensions.h;
    return nodes.map((n, i) => ({
      ...n,
      x: w / 2 + (Math.random() - 0.5) * w * 0.6,
      y: h / 2 + (Math.random() - 0.5) * h * 0.6,
      vx: 0,
      vy: 0,
    }));
  }, [nodes, dimensions]);

  useEffect(() => {
    const container = canvasRef.current?.parentElement;
    if (container) {
      setDimensions({ w: container.clientWidth, h: 500 });
    }
  }, []);

  useEffect(() => {
    nodesRef.current = initNodes();
    let frame = 0;
    const maxFrames = 200;

    const simulate = () => {
      const ns = nodesRef.current;
      const { w, h } = dimensions;

      // Repulsion between nodes
      for (let i = 0; i < ns.length; i++) {
        for (let j = i + 1; j < ns.length; j++) {
          const dx = ns[j].x! - ns[i].x!;
          const dy = ns[j].y! - ns[i].y!;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = 800 / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          ns[i].vx! -= fx;
          ns[i].vy! -= fy;
          ns[j].vx! += fx;
          ns[j].vy! += fy;
        }
      }

      // Attraction along edges
      for (const edge of edges) {
        const source = ns.find((n) => n.id === edge.source);
        const target = ns.find((n) => n.id === edge.target);
        if (!source || !target) continue;
        const dx = target.x! - source.x!;
        const dy = target.y! - source.y!;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = dist * 0.005 * edge.weight;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        source.vx! += fx;
        source.vy! += fy;
        target.vx! -= fx;
        target.vy! -= fy;
      }

      // Center gravity
      for (const n of ns) {
        n.vx! += (w / 2 - n.x!) * 0.001;
        n.vy! += (h / 2 - n.y!) * 0.001;
      }

      // Apply velocity with damping
      const damping = 0.85;
      for (const n of ns) {
        n.vx! *= damping;
        n.vy! *= damping;
        n.x! += n.vx!;
        n.y! += n.vy!;
        n.x! = Math.max(30, Math.min(w - 30, n.x!));
        n.y! = Math.max(30, Math.min(h - 30, n.y!));
      }

      draw();
      frame++;
      if (frame < maxFrames) {
        animRef.current = requestAnimationFrame(simulate);
      }
    };

    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const ns = nodesRef.current;

      ctx.clearRect(0, 0, dimensions.w, dimensions.h);

      // Draw edges
      for (const edge of edges) {
        const source = ns.find((n) => n.id === edge.source);
        const target = ns.find((n) => n.id === edge.target);
        if (!source || !target) continue;

        const isHighlighted = hoveredNode === source.id || hoveredNode === target.id;
        ctx.beginPath();
        ctx.moveTo(source.x!, source.y!);
        ctx.lineTo(target.x!, target.y!);
        ctx.strokeStyle = isHighlighted ? "rgba(99, 102, 241, 0.6)" : "rgba(99, 102, 241, 0.15)";
        ctx.lineWidth = Math.min(edge.weight * 1.5, 4);
        ctx.stroke();
      }

      // Draw nodes
      for (const n of ns) {
        const isHovered = hoveredNode === n.id;
        const radius = Math.max(4, Math.min(14, n.touches * 2.5));
        const isConnected = hoveredNode
          ? edges.some((e) => (e.source === hoveredNode && e.target === n.id) || (e.target === hoveredNode && e.source === n.id))
          : false;

        ctx.beginPath();
        ctx.arc(n.x!, n.y!, radius, 0, Math.PI * 2);

        if (isHovered) {
          ctx.fillStyle = "rgba(99, 102, 241, 0.9)";
          ctx.shadowColor = "rgba(99, 102, 241, 0.5)";
          ctx.shadowBlur = 12;
        } else if (isConnected) {
          ctx.fillStyle = "rgba(99, 102, 241, 0.6)";
          ctx.shadowBlur = 0;
        } else if (n.writes > n.reads) {
          ctx.fillStyle = hoveredNode ? "rgba(245, 158, 11, 0.2)" : "rgba(245, 158, 11, 0.6)";
          ctx.shadowBlur = 0;
        } else {
          ctx.fillStyle = hoveredNode ? "rgba(16, 185, 129, 0.2)" : "rgba(16, 185, 129, 0.5)";
          ctx.shadowBlur = 0;
        }
        ctx.fill();
        ctx.shadowBlur = 0;

        // Label for larger nodes or hovered
        if (radius > 6 || isHovered || isConnected) {
          ctx.font = `${isHovered ? "bold " : ""}10px monospace`;
          ctx.fillStyle = isHovered || isConnected ? "rgba(228, 228, 231, 0.95)" : "rgba(228, 228, 231, 0.55)";
          ctx.textAlign = "center";
          ctx.fillText(n.name, n.x!, n.y! + radius + 12);
        }
      }
    };

    simulate();
    return () => cancelAnimationFrame(animRef.current);
  }, [nodes, edges, dimensions, hoveredNode, initNodes]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const ns = nodesRef.current;
    let found: string | null = null;
    for (const n of ns) {
      const dx = mx - n.x!;
      const dy = my - n.y!;
      const r = Math.max(4, Math.min(14, n.touches * 2.5)) + 4;
      if (dx * dx + dy * dy < r * r) {
        found = n.id;
        break;
      }
    }
    onHover(found);
  }, [onHover]);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={dimensions.w}
        height={500}
        className="w-full h-[500px] cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => onHover(null)}
      />
      {hoveredNode && (
        <div className="absolute top-4 right-4 bg-background/95 border border-card-border rounded-lg p-3 text-xs shadow-lg backdrop-blur-sm">
          <div className="font-mono font-semibold text-foreground">{hoveredNode}</div>
          {(() => {
            const node = nodes.find((n) => n.id === hoveredNode);
            if (!node) return null;
            return (
              <div className="mt-1.5 space-y-0.5 text-muted">
                <div><span className="text-emerald-400">{node.reads}</span> reads &middot; <span className="text-running">{node.writes}</span> writes</div>
                <div>{node.sessions} session{node.sessions !== 1 ? "s" : ""}</div>
              </div>
            );
          })()}
        </div>
      )}
      {/* Legend */}
      <div className="absolute bottom-4 left-4 flex gap-4 text-[10px] text-muted">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" /> Read-heavy</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-running/60" /> Write-heavy</span>
        <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-accent" /> Hovered</span>
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
  const totalImpact = session.linesAdded + session.linesRemoved;
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

function FileChip({ node, maxTouches }: { node: FileNode; maxTouches: number }) {
  const intensity = node.touches / maxTouches;
  const isWriteHeavy = node.writes > node.reads;

  return (
    <div
      className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-mono transition-colors ${
        isWriteHeavy
          ? "border-running/30 bg-running/8 hover:bg-running/15"
          : "border-emerald-500/30 bg-emerald-500/8 hover:bg-emerald-500/15"
      }`}
      style={{ opacity: 0.4 + intensity * 0.6 }}
      title={`${node.id}\n${node.reads} reads, ${node.writes} writes, ${node.sessions} sessions`}
    >
      <span className="text-foreground/80">{node.name}</span>
      <span className="ml-1.5 text-muted">{node.touches}x</span>
    </div>
  );
}
