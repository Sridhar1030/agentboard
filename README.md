# AgentBoard

**A real-time analytics dashboard for AI coding sessions.**

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" alt="React 19" />
  <img src="https://img.shields.io/badge/Tailwind-v4-38BDF8?logo=tailwindcss" alt="Tailwind v4" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="MIT" />
</p>

---

## What is this?

AgentBoard gives you a unified view of everything your AI coding assistants are doing — across all projects, all sessions, all at once. Think of it as your **dev analytics dashboard**, but for AI-generated work.

You open it, and instantly see:
- Which sessions are running right now
- What got built today vs. this week
- How many lines were touched, files changed, context consumed
- The full decision trail for any session (what it read, what it chose, what it modified)

No more switching between chat windows to remember what happened. No more guessing which session introduced a bug.

---

## Quick Look

| View | What you see |
|---|---|
| **Kanban Board** | All sessions organized by recency — Active / Today / Week / Older |
| **Session Detail** | Full conversation replay with tool calls, file touches, and reasoning |
| **Trace Explorer** | DAG trace visualization, timeline, file heatmap, and deep-links for traced sessions |
| **Insights** | Cross-session file intelligence (treemap, co-mod pairs, timeline), filters by workspace/agent trace |

---

## Getting Started

```bash
git clone https://github.com/Sridhar1030/agentboard.git
cd agentboard
npm install
cp .env.example .env.local   # add your Cursor API key
npm run dev                   # http://localhost:3000
```

That's it. The dashboard reads from Cursor's local state — no additional setup needed to see your sessions.

---

## Where does the data come from?

AgentBoard reads from three local sources (nothing leaves your machine):

| Source | What it provides |
|---|---|
| Cursor's internal SQLite DB | Session titles, lines changed, files touched, context usage, mode |
| Transcript files (`.jsonl`) | Full conversation history with tool calls |
| Trace files (`.cursor/traces/`) | Structured decision graphs (optional, from any MCP tracer) |

---

## Features

### Kanban View
Sessions are categorized automatically by their last activity. Search across all sessions by title, project name, or mode. Toggle archived sessions. Pagination loads 50 at a time.

### Session Detail Panel
Click any session card → slide-out panel shows:
- Impact metrics (lines +/-, files changed, context %)
- Full conversation with most-recent-first ordering
- Tool call badges (Read, Write, Shell, Grep, etc.)
- File touch indicators (read vs. write)
- Load More pagination for long conversations
- **Chat ↔ trace linking** — Related MCP sessions appear in a Traces tab; open a match to preview the decision DAG inline or jump to the full Trace Explorer for that session

### Trace Explorer (`/traces`)
For sessions that produce structured traces, the explorer offers three visualization modes:
- **DAG** — Decision graph rendered as an SVG DAG (nodes = steps, edges = parent/child); pan/zoom-friendly layout for following branches
- **Timeline** — Horizontal time-offset bars showing when each step occurred
- **Files** — Heatmap showing which files were touched most (read/write/create breakdown)

The list sorts by recency, shows consistent timestamps, and uses a scrollable sidebar so long session lists stay usable next to the detail pane.

### Insights (`/insights`)
Cross-session analytics scoped by **workspace** and optional **trace session** filters: file intelligence (directory treemap, top co-modification pairs, activity timeline grid), project ranking, and highest-impact sessions — replacing the older force-layout graph with more stable visuals.

### Light & Dark Themes
Toggle with persistence. Both themes designed for readability during long sessions.

---

## Project Structure

```
agentboard/
├── src/
│   ├── app/
│   │   ├── page.tsx                 # Main Kanban dashboard
│   │   ├── traces/page.tsx          # Trace Explorer
│   │   └── api/
│   │       ├── agents/route.ts      # Agent list (paginated)
│   │       ├── agents/[agentId]/    # Agent detail + conversation
│   │       └── traces/              # Trace sessions + detail
│   ├── components/
│   │   ├── KanbanBoard.tsx          # Column layout with pagination
│   │   ├── AgentCard.tsx            # Individual session card
│   │   ├── AgentDetailPanel.tsx     # Slide-out detail view + trace links
│   │   ├── TraceDagSvg.tsx          # DAG visualization for trace steps
│   │   ├── TraceView.tsx            # Conversation timeline renderer
│   │   └── StatsBanner.tsx          # Aggregate metrics bar
│   ├── lib/
│   │   └── agents.ts               # Data layer (SQLite + transcripts)
│   └── types/
│       └── conversation.ts          # Shared TypeScript interfaces
├── docs/                            # Documentation & pitch materials
├── .cursor/
│   ├── mcp.json                     # MCP server config
│   ├── rules/session_trace.mdc      # Auto-tracing rule
│   └── traces/                      # Stored trace files (local)
└── .env.example
```

---

## How is this different from cursor-session-tracer?

| | cursor-session-tracer | AgentBoard |
|---|---|---|
| **What** | MCP server that captures traces | Dashboard that visualizes everything |
| **Language** | Python (FastAPI) | TypeScript (Next.js) |
| **Output** | JSON trace files + CLI renderer | Interactive web UI with analytics |
| **Data sources** | Only its own traces | Cursor DB + Transcripts + Traces |
| **Focus** | Capture & storage | Visualization & insights |

AgentBoard can consume traces from *any* MCP-compatible tracer. The `cursor-session-tracer` is one option — you could write your own, or use a different one entirely.

---

## Configuration

### Environment Variables

```
CURSOR_API_KEY=crsr_your_key_here   # Optional: for SDK-based features
```

### Connecting a Trace Server (Optional)

If you want structured decision graphs in the Trace Explorer, run any MCP tracer that exposes an SSE endpoint:

```json
// .cursor/mcp.json
{
  "mcpServers": {
    "your-tracer": {
      "url": "http://127.0.0.1:8080/sse"
    }
  }
}
```

---

## Built With

- [Next.js 16](https://nextjs.org/) — React framework with server components
- [React 19](https://react.dev/) — UI library
- [Tailwind CSS v4](https://tailwindcss.com/) — Utility-first styling
- [@cursor/sdk](https://cursor.com/docs/sdk/typescript) — Programmatic agent access
- [Model Context Protocol](https://modelcontextprotocol.io/) — Standard for AI tool integration

---

## License

MIT
