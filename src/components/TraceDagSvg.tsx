"use client";

import { useMemo, useState, useCallback } from "react";

export interface DagTraceEvent {
  step_id: string;
  parent_step_id: string | null;
  type: string;
  timestamp: string;
  reason: string;
  files_read: string[];
  files_modified: string[];
  files_created: string[];
  files_deleted: string[];
  notes?: string;
}

const NODE_W = 210;
const NODE_H = 76;
const H_GAP = 44;
const V_GAP = 52;
const PAD = 48;
const CORNER_RX = 10;

function parseTraceInstant(iso: string): Date {
  if (!iso) return new Date(NaN);
  const t = iso.trim();
  if (/^\d+$/.test(t)) {
    const n = parseInt(t, 10);
    return new Date(n < 1e12 ? n * 1000 : n);
  }
  if (/Z$|[+-]\d{2}:?\d{2}$/.test(t)) return new Date(t);
  const withZ = t.includes("T") && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(t) ? `${t}Z` : t;
  return new Date(withZ);
}

type TreeNode = {
  id: string;
  event: DagTraceEvent;
  children: TreeNode[];
};

function isRootParent(
  pid: string | null | undefined,
  sessionId: string,
  byId: Map<string, DagTraceEvent>
): boolean {
  if (pid == null || pid === "") return true;
  if (pid === "root") return true;
  if (pid === sessionId) return true;
  if (!byId.has(pid)) return true;
  return false;
}

function buildTree(events: DagTraceEvent[], sessionId: string): TreeNode {
  const byId = new Map(events.map((e) => [e.step_id, e]));
  const childrenByParent = new Map<string, DagTraceEvent[]>();

  for (const e of events) {
    const p = e.parent_step_id;
    let parentKey: string;
    if (isRootParent(p, sessionId, byId)) {
      parentKey = "__root__";
    } else {
      parentKey = p as string;
    }
    if (!childrenByParent.has(parentKey)) childrenByParent.set(parentKey, []);
    childrenByParent.get(parentKey)!.push(e);
  }

  for (const arr of childrenByParent.values()) {
    arr.sort(
      (a, b) =>
        parseTraceInstant(a.timestamp).getTime() - parseTraceInstant(b.timestamp).getTime() ||
        a.step_id.localeCompare(b.step_id)
    );
  }

  function mk(id: string, event: DagTraceEvent): TreeNode {
    const ch = childrenByParent.get(id) || [];
    return { id, event, children: ch.map((ev) => mk(ev.step_id, ev)) };
  }

  const rootEvents = childrenByParent.get("__root__") || [];
  const dummy: DagTraceEvent = {
    step_id: "__virtual__",
    parent_step_id: null,
    type: "checkpoint",
    timestamp: "",
    reason: "",
    files_read: [],
    files_modified: [],
    files_created: [],
    files_deleted: [],
  };

  return {
    id: "__virtual__",
    event: dummy,
    children: rootEvents.map((ev) => mk(ev.step_id, ev)),
  };
}

type Placed = TreeNode & {
  x: number;
  y: number;
};

function layoutSubtree(node: TreeNode, depth: number, left: number): { node: Placed; right: number } {
  const y = PAD + depth * (NODE_H + V_GAP);
  if (node.children.length === 0) {
    const cx = left + NODE_W / 2;
    return { node: { ...node, x: cx, y }, right: left + NODE_W };
  }

  let cur = left;
  const placedChildren: Placed[] = [];
  for (const c of node.children) {
    const { node: pc, right } = layoutSubtree(c, depth + 1, cur);
    placedChildren.push(pc);
    cur = right + H_GAP;
  }
  cur -= H_GAP;
  const firstX = placedChildren[0]!.x;
  const lastX = placedChildren[placedChildren.length - 1]!.x;
  const parentX = (firstX + lastX) / 2;
  return {
    node: { ...node, x: parentX, y, children: placedChildren },
    right: cur,
  };
}

function flatten(node: Placed): Placed[] {
  const out: Placed[] = [];
  function walk(n: Placed) {
    out.push(n);
    for (const c of n.children as Placed[]) walk(c);
  }
  walk(node);
  return out;
}

function translateX(root: Placed, dx: number): Placed {
  function t(n: Placed): Placed {
    return {
      ...n,
      x: n.x + dx,
      children: (n.children as Placed[]).map(t),
    };
  }
  return t(root);
}

function getTypeStyle(type: string): { fill: string; stroke: string } {
  const t = type.toLowerCase();
  if (t === "decision")
    return { fill: "rgba(59, 130, 246, 0.22)", stroke: "rgba(96, 165, 250, 0.75)" };
  if (t === "implementation")
    return { fill: "rgba(34, 197, 94, 0.2)", stroke: "rgba(74, 222, 128, 0.7)" };
  if (t === "investigation")
    return { fill: "rgba(234, 179, 8, 0.22)", stroke: "rgba(250, 204, 21, 0.7)" };
  if (t === "file_modify")
    return { fill: "rgba(16, 185, 129, 0.18)", stroke: "rgba(52, 211, 153, 0.65)" };
  if (t === "checkpoint")
    return { fill: "rgba(167, 139, 250, 0.18)", stroke: "rgba(196, 181, 253, 0.65)" };
  if (t === "tool_call")
    return { fill: "rgba(148, 163, 184, 0.15)", stroke: "rgba(148, 163, 184, 0.55)" };
  return { fill: "rgba(100, 116, 139, 0.2)", stroke: "rgba(148, 163, 184, 0.6)" };
}

function shortLabel(reason: string, max = 72): string {
  const one = reason.replace(/\s+/g, " ").trim();
  if (one.length <= max) return one;
  return one.slice(0, max - 1) + "…";
}

export interface TraceDagSvgProps {
  events: DagTraceEvent[];
  sessionId: string;
  expandedStep: string | null;
  onToggle: (id: string | null) => void;
}

export function TraceDagSvg({ events, sessionId, expandedStep, onToggle }: TraceDagSvgProps) {
  const [hoverId, setHoverId] = useState<string | null>(null);

  const { root, width, height, edges, nodes } = useMemo(() => {
    if (events.length === 0) {
      return { root: null as Placed | null, width: 400, height: 200, edges: [] as [string, string][], nodes: [] as Placed[] };
    }

    const tree = buildTree(events, sessionId);
    if (tree.children.length === 0) {
      return { root: null, width: 400, height: 200, edges: [], nodes: [] };
    }

    const { node: laid } = layoutSubtree(tree, 0, 0);
    const all = flatten(laid);
    const xs = all.map((n) => n.x);
    const minX = Math.min(...xs) - NODE_W / 2;
    const maxX = Math.max(...xs) + NODE_W / 2;
    const shift = PAD - minX;
    const shifted = translateX(laid, shift);

    const flat = flatten(shifted).filter((n) => n.id !== "__virtual__");
    const depthMax = Math.max(...flat.map((n) => (n.y - PAD) / (NODE_H + V_GAP)), 0);

    const w = maxX - minX + PAD * 2;
    const h = PAD * 2 + depthMax * (NODE_H + V_GAP) + NODE_H;

    const edgeList: [string, string][] = [];
    function collectE(n: Placed) {
      for (const c of n.children as Placed[]) {
        if (n.id !== "__virtual__") edgeList.push([n.id, c.id]);
        collectE(c);
      }
    }
    collectE(shifted);

    return { root: shifted, width: w, height: h, edges: edgeList, nodes: flat };
  }, [events, sessionId]);

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const activeId = expandedStep || hoverId;

  const handleKey = useCallback(
    (e: React.KeyboardEvent, id: string) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onToggle(expandedStep === id ? null : id);
      }
    },
    [expandedStep, onToggle]
  );

  if (!root || events.length === 0) {
    return (
      <div className="rounded-xl border border-card-border bg-card/30 px-4 py-8 text-center text-sm text-muted">
        No steps to visualize.
      </div>
    );
  }

  return (
    <div className="relative w-full overflow-auto rounded-xl border border-card-border bg-[#0a0d12] shadow-inner">
      <svg
        width={width}
        height={height}
        className="mx-auto block min-w-full"
        style={{ minHeight: height }}
        aria-label="Decision DAG"
      >
        <defs>
          <filter id="dag-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="dag-edge" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(56, 189, 248, 0.35)" />
            <stop offset="100%" stopColor="rgba(99, 102, 241, 0.45)" />
          </linearGradient>
        </defs>

        {/* Edges */}
        <g className="pointer-events-none">
          {edges.map(([from, to]) => {
            const a = byId.get(from);
            const b = byId.get(to);
            if (!a || !b) return null;
            const x1 = a.x;
            const y1 = a.y + NODE_H / 2;
            const x2 = b.x;
            const y2 = b.y - NODE_H / 2;
            const mid = (y1 + y2) / 2;
            const d = `M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`;
            const highlight = activeId === from || activeId === to;
            return (
              <path
                key={`${from}-${to}`}
                d={d}
                fill="none"
                stroke={highlight ? "url(#dag-edge)" : "rgba(71, 85, 105, 0.55)"}
                strokeWidth={highlight ? 2.2 : 1.35}
                opacity={highlight ? 0.95 : 0.65}
              />
            );
          })}
        </g>

        {/* Nodes */}
        <g>
          {nodes.map((n) => {
            const st = getTypeStyle(n.event.type);
            const isOpen = expandedStep === n.id;
            const isHot = hoverId === n.id || isOpen;
            const left = n.x - NODE_W / 2;
            const top = n.y - NODE_H / 2;
            const label = shortLabel(n.event.reason || n.event.type, 90);

            return (
              <g
                key={n.id}
                role="button"
                tabIndex={0}
                aria-pressed={isOpen}
                aria-expanded={isOpen}
                onMouseEnter={() => setHoverId(n.id)}
                onMouseLeave={() => setHoverId(null)}
                onClick={() => onToggle(isOpen ? null : n.id)}
                onKeyDown={(e) => handleKey(e, n.id)}
                className="cursor-pointer outline-none"
                style={{ filter: isHot ? "url(#dag-glow)" : undefined }}
              >
                <rect
                  x={left}
                  y={top}
                  width={NODE_W}
                  height={NODE_H}
                  rx={CORNER_RX}
                  fill={st.fill}
                  stroke={st.stroke}
                  strokeWidth={isHot ? 2.2 : 1.4}
                  className="transition-all"
                />
                <text
                  x={n.x}
                  y={top + 22}
                  textAnchor="middle"
                  fill="rgba(248, 250, 252, 0.9)"
                  fontSize={10}
                  fontWeight={700}
                  letterSpacing="0.06em"
                  textRendering="geometricPrecision"
                  style={{ textTransform: "uppercase" }}
                >
                  {n.event.type.replace(/_/g, " ")}
                </text>
                <text
                  x={n.x}
                  y={top + 44}
                  textAnchor="middle"
                  fill="rgba(226, 232, 240, 0.92)"
                  fontSize={11}
                >
                  {label}
                </text>
                <title>{[n.event.reason, n.event.notes].filter(Boolean).join("\n\n")}</title>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Detail panel under hover/selection — full reason + files */}
      {activeId && byId.get(activeId) && (
        <div className="border-t border-card-border bg-card/50 px-4 py-3 text-sm backdrop-blur-sm">
          <DagStepDetail event={byId.get(activeId)!.event} />
        </div>
      )}
    </div>
  );
}

function DagStepDetail({ event }: { event: DagTraceEvent }) {
  const total =
    event.files_read.length +
    event.files_modified.length +
    event.files_created.length +
    event.files_deleted.length;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] text-muted">{event.step_id}</span>
        <span className="rounded border border-card-border bg-background/80 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted">
          {event.type.replace(/_/g, " ")}
        </span>
        {total > 0 && <span className="text-[10px] text-muted">{total} file touches</span>}
      </div>
      <p className="text-[13px] leading-relaxed text-foreground/90">{event.reason}</p>
      {event.notes ? <p className="text-xs italic text-muted">{event.notes}</p> : null}
      <div className="grid gap-2 sm:grid-cols-2">
        {event.files_read.length > 0 && <FileCol label="Read" files={event.files_read} tone="emerald" />}
        {event.files_modified.length > 0 && <FileCol label="Modified" files={event.files_modified} tone="amber" />}
        {event.files_created.length > 0 && <FileCol label="Created" files={event.files_created} tone="indigo" />}
        {event.files_deleted.length > 0 && <FileCol label="Deleted" files={event.files_deleted} tone="red" />}
      </div>
    </div>
  );
}

function FileCol({ label, files, tone }: { label: string; files: string[]; tone: "emerald" | "amber" | "indigo" | "red" }) {
  const cls: Record<string, string> = {
    emerald: "border-emerald-500/25 bg-emerald-500/10 text-emerald-100",
    amber: "border-amber-500/25 bg-amber-500/10 text-amber-100",
    indigo: "border-indigo-500/25 bg-indigo-500/10 text-indigo-100",
    red: "border-red-500/25 bg-red-500/10 text-red-100",
  };
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wider text-muted">{label}</div>
      <ul className="mt-1 space-y-0.5">
        {files.map((f, i) => (
          <li
            key={i}
            className={`truncate rounded border px-1.5 py-0.5 font-mono text-[10px] ${cls[tone]}`}
            title={f}
          >
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}
