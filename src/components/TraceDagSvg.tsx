"use client";

import {
  useMemo,
  useState,
  useCallback,
  useRef,
  useLayoutEffect,
  useEffect,
  type KeyboardEvent,
} from "react";

import { sanitizeTraceLinkage, type DagTraceEvent } from "@/lib/traceDagNormalize";

export type { DagTraceEvent };

const NODE_W = 260;
const NODE_H = 96;
const H_GAP = 120;
const V_GAP = 80;
const PAD = 72;
const CORNER_RX = 12;

const LABEL_MAX = 40;

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

function isRootParent(pid: string | null | undefined, sessionId: string, byId: Map<string, DagTraceEvent>): boolean {
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

export function getTypeStyle(type: string): { fill: string; stroke: string; label: string } {
  const t = type.toLowerCase();
  if (t === "decision")
    return { fill: "rgba(59, 130, 246, 0.22)", stroke: "rgba(96, 165, 250, 0.85)", label: "Decision" };
  if (t === "implementation")
    return { fill: "rgba(34, 197, 94, 0.2)", stroke: "rgba(74, 222, 128, 0.75)", label: "Implementation" };
  if (t === "investigation")
    return { fill: "rgba(234, 179, 8, 0.22)", stroke: "rgba(250, 204, 21, 0.75)", label: "Investigation" };
  if (t === "file_modify")
    return { fill: "rgba(16, 185, 129, 0.18)", stroke: "rgba(52, 211, 153, 0.7)", label: "File modify" };
  if (t === "checkpoint")
    return { fill: "rgba(167, 139, 250, 0.2)", stroke: "rgba(196, 181, 253, 0.75)", label: "Checkpoint" };
  if (t === "tool_call")
    return { fill: "rgba(148, 163, 184, 0.15)", stroke: "rgba(148, 163, 184, 0.55)", label: "Tool call" };
  return { fill: "rgba(100, 116, 139, 0.2)", stroke: "rgba(148, 163, 184, 0.65)", label: "Other" };
}

const LEGEND_TYPES = ["decision", "implementation", "investigation", "file_modify", "checkpoint", "tool_call"] as const;

function shortLabel(reason: string, max = LABEL_MAX): string {
  const one = reason.replace(/\s+/g, " ").trim();
  if (one.length <= max) return one;
  return one.slice(0, max - 1) + "…";
}

export interface TraceDagSvgProps {
  events: DagTraceEvent[];
  sessionId: string;
  expandedStep: string | null;
  onToggle: (id: string | null) => void;
  /** Extra class on outer wrapper */
  className?: string;
}

export function TraceDagSvg(props: TraceDagSvgProps) {
  const eventsKey = useMemo(() => props.events.map((e) => e.step_id).join("|"), [props.events]);
  return <TraceDagSvgInner key={`${props.sessionId}:${eventsKey}`} {...props} />;
}

function TraceDagSvgInner({ events, sessionId, expandedStep, onToggle, className = "" }: TraceDagSvgProps) {
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [fitDone, setFitDone] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const mountFit = useRef(true);

  const { root, width, height, edges, nodes } = useMemo(() => {
    const normalized = sanitizeTraceLinkage(events, sessionId);
    if (normalized.length === 0) {
      return { root: null as Placed | null, width: 400, height: 200, edges: [] as [string, string][], nodes: [] as Placed[] };
    }

    const tree = buildTree(normalized, sessionId);
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

  /** Prefer live hover preview; fall back to pinned selection. */
  const activeId = hoverId ?? expandedStep;

  const handleKey = useCallback(
    (e: KeyboardEvent, id: string) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onToggle(expandedStep === id ? null : id);
      }
    },
    [expandedStep, onToggle]
  );

  const trackPointer = useCallback((e: { clientX: number; clientY: number }) => {
    setPointer({ x: e.clientX, y: e.clientY });
  }, []);

  const tryFit = useCallback(() => {
    const el = scrollRef.current;
    if (!el || width < 10 || height < 10) return;
    const cw = el.clientWidth;
    const ch = el.clientHeight;
    if (cw < 32 || ch < 32) return;
    const s = Math.min(cw / width, ch / height, 2) * 0.94;
    if (s > 0 && Number.isFinite(s)) {
      setZoom(s);
      setFitDone(true);
    }
  }, [width, height]);

  useLayoutEffect(() => {
    if (fitDone) return;
    tryFit();
    if (!mountFit.current) return;
    mountFit.current = false;
    const t = requestAnimationFrame(() => tryFit());
    return () => cancelAnimationFrame(t);
  }, [width, height, fitDone, tryFit, events.length]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || fitDone) return;
    const ro = new ResizeObserver(() => tryFit());
    ro.observe(el);
    return () => ro.disconnect();
  }, [fitDone, tryFit, sessionId]);

  if (!root) {
    return (
      <div
        className={`rounded-xl border border-card-border bg-card/30 px-4 py-8 text-center text-sm text-muted ${className}`}
      >
        No steps to visualize.
      </div>
    );
  }

  const detailEvent = activeId ? byId.get(activeId)?.event : undefined;

  return (
    <div
      className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-card-border bg-[#06090f] shadow-inner ${className}`}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-card-border bg-card/40 px-3 py-2.5 backdrop-blur-sm">
        <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-muted">Types</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {LEGEND_TYPES.map((tp) => {
            const st = getTypeStyle(tp);
            return (
              <span
                key={tp}
                className="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-medium text-foreground/90"
                style={{ borderColor: st.stroke, backgroundColor: st.fill }}
              >
                <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: st.stroke }} />
                {st.label}
              </span>
            );
          })}
          <span
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-500/40 bg-slate-500/15 px-2 py-0.5 text-[10px] font-medium text-muted"
            title="Any type not listed explicitly"
          >
            Other
          </span>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.25, +(z / 1.2).toFixed(4)))}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-card-border bg-background/80 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent"
            aria-label="Zoom out"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(3, +(z * 1.2).toFixed(4)))}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-card-border bg-background/80 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent"
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => {
              if (!scrollRef.current) return;
              const el = scrollRef.current;
              const cw = el.clientWidth;
              const ch = el.clientHeight;
              const s = Math.min(cw / width, ch / height, 2) * 0.94;
              if (s > 0 && Number.isFinite(s)) setZoom(s);
            }}
            className="rounded-lg border border-card-border bg-background/80 px-2.5 py-1.5 text-[11px] font-medium text-muted transition hover:border-accent hover:text-accent"
          >
            Fit
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="relative min-h-[320px] flex-1 overflow-auto"
        role="presentation"
        onMouseMove={trackPointer}
      >
        <style>{`
          @keyframes trace-edge-flow {
            to { stroke-dashoffset: -32; }
          }
          .trace-dag-edge {
            stroke-dasharray: 10 8;
            animation: trace-edge-flow 1.4s linear infinite;
          }
        `}</style>
        <div
          style={{
            width: width * zoom,
            height: height * zoom,
            minWidth: "100%",
            minHeight: "100%",
            margin: "0 auto",
          }}
          className="relative flex items-start justify-center p-2"
        >
          <svg
            width={width}
            height={height}
            className="block h-full w-full max-w-none"
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="xMidYMid meet"
            style={{ width: width * zoom, height: height * zoom }}
            aria-label="Decision DAG"
          >
            <defs>
              <filter id="dag-glow" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="4" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <linearGradient id="dag-edge" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="rgba(56, 189, 248, 0.45)" />
                <stop offset="100%" stopColor="rgba(99, 102, 241, 0.55)" />
              </linearGradient>
            </defs>

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
                    strokeWidth={highlight ? 2.4 : 1.5}
                    opacity={highlight ? 0.98 : 0.62}
                    className="trace-dag-edge"
                    style={{ animationDuration: highlight ? "1.4s" : "2s" }}
                  />
                );
              })}
            </g>

            <g>
              {nodes.map((n) => {
                const st = getTypeStyle(n.event.type);
                const isOpen = expandedStep === n.id;
                const isHot = hoverId === n.id || isOpen;
                const left = n.x - NODE_W / 2;
                const top = n.y - NODE_H / 2;
                const label = shortLabel(n.event.reason || n.event.type, LABEL_MAX);

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
                    onMouseMove={trackPointer}
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
                      strokeWidth={isHot ? 2.4 : 1.5}
                      className="transition-all duration-200"
                    />
                    <text
                      x={n.x}
                      y={top + 26}
                      textAnchor="middle"
                      fill="rgba(248, 250, 252, 0.95)"
                      fontSize={11}
                      fontWeight={700}
                      letterSpacing="0.05em"
                      textRendering="geometricPrecision"
                      style={{ textTransform: "uppercase" }}
                    >
                      {n.event.type.replace(/_/g, " ")}
                    </text>
                    <text
                      x={n.x}
                      y={top + 54}
                      textAnchor="middle"
                      fill="rgba(226, 232, 240, 0.92)"
                      fontSize={12}
                    >
                      {label}
                    </text>
                    <title>{[n.event.reason, n.event.notes].filter(Boolean).join("\n\n")}</title>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>
      </div>

      {detailEvent && (
        <DagHoverCard
          event={detailEvent}
          pointer={pointer}
          followPointer={hoverId !== null}
          showPinnedChrome={Boolean(expandedStep)}
        />
      )}
    </div>
  );
}

function DagHoverCard({
  event,
  pointer,
  followPointer,
  showPinnedChrome,
}: {
  event: DagTraceEvent;
  pointer: { x: number; y: number };
  followPointer: boolean;
  showPinnedChrome: boolean;
}) {
  const total =
    event.files_read.length +
    event.files_modified.length +
    event.files_created.length +
    event.files_deleted.length;

  const pad = 14;
  const cardW = 352;
  const cardH = 280;
  const px = followPointer
    ? Math.min(Math.max(pad, pointer.x + pad), typeof window !== "undefined" ? window.innerWidth - cardW - pad : pointer.x)
    : undefined;
  const py = followPointer
    ? Math.min(Math.max(pad, pointer.y + pad), typeof window !== "undefined" ? window.innerHeight - cardH - pad : pointer.y)
    : undefined;

  return (
    <div
      className={`pointer-events-none fixed z-[100] w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-card-border bg-card/95 p-4 text-sm shadow-2xl shadow-black/50 backdrop-blur-md transition-[opacity,transform] duration-150 ${
        showPinnedChrome && !followPointer ? "ring-1 ring-accent/30" : ""
      } ${!followPointer ? "bottom-6 right-6" : ""}`}
      style={
        followPointer
          ? { left: px, top: py, maxHeight: "min(280px, 40vh)" }
          : { maxHeight: "min(280px, 40vh)" }
      }
      role="tooltip"
    >
      <div className="pointer-events-auto max-h-[min(240px,36vh)] overflow-y-auto pr-1">
        <div className="flex flex-wrap items-center gap-2 border-b border-card-border/80 pb-2">
          <span className="font-mono text-[10px] text-muted">{event.step_id}</span>
          <span className="rounded border border-card-border bg-background/80 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted">
            {event.type.replace(/_/g, " ")}
          </span>
          {total > 0 && <span className="text-[10px] text-muted">{total} file touches</span>}
          {showPinnedChrome && !followPointer && (
            <span className="ml-auto text-[10px] font-medium text-accent">Pinned</span>
          )}
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-foreground/95">{event.reason}</p>
        {event.notes ? <p className="mt-2 text-xs italic text-muted">{event.notes}</p> : null}
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {event.files_read.length > 0 && <FileCol label="Read" files={event.files_read} tone="emerald" />}
          {event.files_modified.length > 0 && <FileCol label="Modified" files={event.files_modified} tone="amber" />}
          {event.files_created.length > 0 && <FileCol label="Created" files={event.files_created} tone="indigo" />}
          {event.files_deleted.length > 0 && <FileCol label="Deleted" files={event.files_deleted} tone="red" />}
        </div>
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
