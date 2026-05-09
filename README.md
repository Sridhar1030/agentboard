# AgentBoard

**Developer analytics for AI-assisted coding — built on the [Cursor TypeScript SDK](https://cursor.com/docs/sdk/typescript) and local-first data.**

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" alt="React 19" />
  <img src="https://img.shields.io/badge/Tailwind-v4-38BDF8?logo=tailwindcss" alt="Tailwind v4" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="MIT" />
</p>

---

## Why this exists

Modern teams run dozens of **Cursor agent sessions** per day across many repos. The IDE shows one chat at a time; memory of *what ran where*, *how reasoning unfolded*, and *whether prompts were effective* lives in scattered history.

**AgentBoard** is a **local web dashboard** that turns Cursor’s on-disk session data into a coherent picture: a Kanban-style board, deep session pages, cross-repo insights, and — as the standout experiment — **Prompt Coach**, which scores how you prompt agents and suggests tighter instructions so you get better results on the first try.

It is **not** a hosted SaaS: data stays on your machine. It demonstrates how far you can push **programmable agents (`@cursor/sdk`)**, **MCP session tracing**, and **SQLite + transcript parsing** in a single Next.js app.

---

## Feature highlights

| Area | What you get |
|------|----------------|
| **Kanban board** | All agent sessions in status-style columns with **pagination**, **workspace filter**, and recency ordering — at-a-glance load across projects. |
| **Full agent session** (`/agent/[id]`) | Dedicated page: **metadata**, **activity** trace, **reasoning DAG**, **files** touched, and **Prompt Coach** — no cramped slide-over. |
| **Reasoning DAG** | **SVG** directed graph of trace steps: **animated edges**, **pan/zoom**, **hover cards** for context — same engine on the agent page and Trace Explorer. |
| **Prompt Coach** | AI-assisted analysis of *your* prompts vs. the transcript: **letter grade (A–D)**, **ideal prompt** suggestion, **correction patterns**, productivity vs. wasted turns. Uses the Cursor SDK where configured, with **disk caching** so repeat views do not burn tokens. |
| **Cross-session insights** (`/insights`) | **Directory hotspots**, **co-modification pairs**, **file activity timeline** across sessions, with **workspace** and **agent / trace** filtering. |
| **Trace Explorer** (`/traces`) | Browse every reasoning trace with proper **timestamps**, **most-recent-first** ordering, and a **sidebar layout** with independent scrolling next to the DAG/detail pane. |
| **Session tracing (MCP)** | Optional **cursor-session-tracer** integration writes structured JSON under `.cursor/traces/`, with **workspace path tagging** so traces match the right project reliably. |
| **Theme & stats** | **Light/dark** toggle with **localStorage** persistence; **stats banner** aggregates sessions, lines touched, files changed, and **mode** breakdown (Agent / Multitask / Chat). |

---

## Quick look

| Route / surface | Purpose |
|-----------------|--------|
| `/` | Kanban dashboard |
| `/agent/[id]` | Full session: activity · DAG · files · Prompt Coach |
| `/insights` | Cross-session analytics |
| `/traces` | Global trace list + DAG explorer |

---

## Getting Started

```bash
git clone https://github.com/Sridhar1030/agentboard.git
cd agentboard
npm install
cp .env.example .env.local   # add CURSOR_API_KEY for SDK features (Prompt Coach refinement)
npm run dev                   # http://localhost:3000
```

The board works **without** an API key by reading Cursor’s local SQLite state and transcripts. A key unlocks **SDK-backed** prompt coaching and richer narrative output.

---

## Where the data comes from

Everything stays **local** unless you opt into API calls (Prompt Coach with SDK):

| Source | Role |
|--------|------|
| Cursor **global state** (`state.vscdb`) | Session titles, timestamps, lines/files, context %, mode, workspace id |
| **Transcripts** (`.jsonl` per agent) | Full chat + tool calls for replay and Prompt Coach |
| **Trace files** (`.cursor/traces/`, optional MCP) | Reasoning DAG events for visualization and cross-session insights |

---

## Project structure (abbreviated)

```
src/app/
  page.tsx                    # Kanban home
  agent/[agentId]/page.tsx   # Full session + tabs (activity, DAG, files, coach)
  insights/page.tsx          # Cross-session insights
  traces/page.tsx            # Trace Explorer
  api/agents/…               # List, detail, coach
  api/traces/…               # Trace list + detail
  api/insights/route.ts      # Aggregated insight queries
src/components/
  KanbanBoard.tsx, AgentCard.tsx, StatsBanner.tsx, …
  TraceDagSvg.tsx             # SVG DAG (zoom, edges, hover)
src/lib/
  agents.ts                   # SQLite + transcript I/O
  promptCoach.ts              # Heuristics + SDK enrichment
  agentTraceMatch.ts         # Trace ↔ agent matching (workspace-aware)
docs/                         # Roadmap, architecture, use cases
.cursor/traces/               # MCP tracer output (gitignored patterns apply)
.cursor/coach-cache/          # Prompt Coach disk cache (generated)
```

---

## How this differs from cursor-session-tracer alone

| | cursor-session-tracer (MCP) | AgentBoard |
|---|---------------------------|------------|
| Role | Captures traces to disk | **Visualizes** DB + transcripts + traces |
| Stack | Python / FastAPI | Next.js + TypeScript |
| Output | JSON traces | **Interactive** UI, insights, Prompt Coach |

Use the tracer (or any MCP-compatible emitter) for **capture**; use AgentBoard for **observability and coaching**.

---

## Configuration

### Environment

```
CURSOR_API_KEY=crsr_your_key_here   # Optional; enables SDK refinement in Prompt Coach
```

### MCP tracing (optional)

Point `.cursor/mcp.json` at your tracer’s SSE endpoint. Session tracing should pass **workspace** paths so AgentBoard can correlate traces with the correct repo.

---

## Built with

- [Next.js 16](https://nextjs.org/) — App Router, API routes
- [React 19](https://react.dev/)
- [Tailwind CSS v4](https://tailwindcss.com/)
- [@cursor/sdk](https://cursor.com/docs/sdk/typescript) — Prompt Coach and agent automation
- [Model Context Protocol](https://modelcontextprotocol.io/) — session trace capture

---

## License

MIT
