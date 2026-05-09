# Architecture Overview

## System design

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AgentBoard (Next.js 16 + React 19 + Tailwind v4)   │
│                                                                              │
│  Home `/` — Kanban + StatsBanner (sessions, lines, files, mode breakdown)  │
│  + workspace filter · pagination · theme (localStorage)                     │
│                                                                              │
│  `/agent/[id]` — Full session page                                          │
│  • Activity (transcript / tool trace)                                       │
│  • Reasoning DAG — TraceDagSvg (SVG, zoom, animated edges, hover cards)      │
│  • Files tab                                                                 │
│  • Prompt Coach — grade, ideal prompt, tips, correction moments              │
│                                                                              │
│  `/insights` — Cross-session analytics (hotspots, co-mod pairs, timeline)  │
│  `/traces`   — Trace Explorer (MRF list, independent sidebar scroll, DAG)    │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              ▼                  ▼                  ▼
   ┌──────────────────┐  ┌──────────────┐  ┌───────────────────────┐
   │ Cursor global    │  │ Transcripts  │  │ MCP session tracer    │
   │ state (SQLite)   │  │ `.jsonl`     │  │ → `.cursor/traces/`   │
   └──────────────────┘  └──────────────┘  └───────────────────────┘
              │                  │                  │
              ▼                  ▼                  ▼
       Composer headers    Chat + tools      DAG events + workspace tag
```

## Data sources

### 1. Cursor Global State DB (`state.vscdb`)

**Path:** `~/Library/Application Support/Cursor/User/globalStorage/state.vscdb` (macOS)

SQLite; we read `composer.composerHeaders` from `ItemTable` for:

- `composerId`, `name`, `lastUpdatedAt`, `createdAt`
- `totalLinesAdded` / `totalLinesRemoved`, `filesChangedCount`, `contextUsagePercent`
- `unifiedMode` — Agent / Multitask / Chat
- `isArchived`, `workspaceIdentifier`

### 2. Agent Transcripts (`.jsonl`)

**Path:** `~/.cursor/projects/<project-hash>/agent-transcripts/<agent-id>/<agent-id>.jsonl`

Used for conversation replay, file touch extraction, and **Prompt Coach** input.

### 3. Session traces (`.cursor/traces/`)

**Path:** `.cursor/traces/YYYYMMDD/<session-id>/…json`

Emitted by MCP tracers (e.g. **cursor-session-tracer**). Events form a **DAG** via `parent_step_id`. When the tracer’s **start_trace** includes a **workspace** root, traces can be matched to the correct Cursor project in **`agentTraceMatch`** (title overlap, timing windows, workspace path).

## Frontend components (selected)

| Component | Role |
|-----------|------|
| `TraceDagSvg` | Renders trace steps as an **SVG** graph: layout, **animated** edges between parent/child steps, **pan/zoom**, expandable nodes, **hover** detail. Shared by `/agent/[id]` and `/traces`. |
| `StatsBanner` | Aggregate metrics: session counts, lines touched, files changed, **mode** distribution. |
| Kanban stack | Column layout, cards, **pagination**, **workspace** filter, theme toggle. |

## Prompt Coach pipeline

```
Transcript .jsonl
      │
      ▼
analyzeTranscriptHeuristic()     ← fast local pass (grade, turns, patterns, ideal prompt shell)
      │
      ▼ (optional, if CURSOR_API_KEY)
enrichWithSdkCoach()           ← @cursor/sdk: tighter narrative + coaching JSON
      │
      ▼
GET /api/agents/[id]/coach
      │
      ├── Disk cache: `.cursor/coach-cache/<agentId>.json`
      │   Invalidated when transcript mtime + size change (or `?force=true`)
      └── Returns CoachApiResponse (grade, summary, idealPrompt, tips, correctionMoments, …)
```

**Design goals:** default path works offline; SDK adds quality when configured; **caching** avoids duplicate token spend for unchanged transcripts.

## API routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/agents` | GET | Paginated agent list (`offset`, `limit`) |
| `/api/agents/[agentId]` | GET | Agent metadata + conversation slice |
| `/api/agents/[agentId]/coach` | GET | Prompt Coach analysis (`?force=true` bypasses cache) |
| `/api/traces` | GET | Trace session index |
| `/api/traces/[sessionId]` | GET | Trace detail + events for DAG |
| `/api/insights` | GET | Cross-session aggregates for `/insights` |

## Key design decisions

1. **Local-first** — Primary reads are filesystem + SQLite; no cloud requirement.
2. **Pagination** — Agent list and transcripts use offset/limit for large histories.
3. **Transcript order** — UI emphasizes **recent** activity (most-recent-first where applicable).
4. **Trace ↔ agent matching** — **`agentTraceMatch`** uses time windows, title/token overlap, and **workspace** fields from trace metadata to link Kanban sessions to MCP traces.
5. **MCP for tracing** — Standard protocol; workspace-tagged **start_trace** improves match quality.
6. **Coach caching** — File-backed cache keyed on transcript stat so development and repeated views stay cheap.
