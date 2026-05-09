# AgentBoard

### The missing observability layer for AI coding agents.

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" alt="React 19" />
  <img src="https://img.shields.io/badge/Tailwind-v4-38BDF8?logo=tailwindcss" alt="Tailwind v4" />
  <img src="https://img.shields.io/badge/MCP-Protocol-purple" alt="MCP" />
  <img src="https://img.shields.io/badge/Cursor-SDK-00DC82" alt="Cursor SDK" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="MIT" />
</p>

---

**AI agents write code. AgentBoard shows you *how they think*.**

When agents drive development, you lose visibility into the decision chain. Git blame tells you _what_ changed — not _why_ the agent chose that approach, what alternatives it considered, or which files it read before deciding. **AgentBoard** is the observability layer that captures reasoning traces, surfaces impact metrics, and makes AI-powered development auditable.

---

## The Problem

| Today's Reality | What's Missing |
|---|---|
| Git diffs show what changed | No record of why the agent chose that approach |
| PR reviews see final output | No visibility into the reasoning chain |
| Usage dashboards show token spend | No correlation between spend and code impact |
| Agent sessions vanish after chat closes | No searchable history across projects |

**This is agentic amnesia.** AgentBoard fixes it.

---

## Features

### Unified Kanban Dashboard
All Cursor agent sessions across every project in a single view:

- **Real-time columns** — Active / Today / This Week / Older
- **Impact metrics** — Lines added/removed, files changed, context usage
- **Search & filter** — Find any session by title, project, or mode
- **Light & Dark themes** — Toggle with persistence

### Reasoning Traces

Each agent session produces a structured reasoning trace — a directed graph of decisions:

```
Session Start
  └─ step_001 [decision]     "auth.py uses APIKeyAuth, need BearerToken..."
       └─ step_002 [file_modify]  "Replacing APIKeyAuth class..."
            └─ step_003 [file_modify]  "Updating imports in github.py..."
```

Traces capture:
- **What** — decision / file_modify / tool_call / checkpoint
- **Why** — natural-language reasoning for each step
- **Files** — read, modified, created, or deleted
- **Chain** — parent-child relationships between steps
- **Cost** — model, token counts, USD spend per session

### Session Detail View
Click any card to see the full conversation trace:
- Tool call visualization (file edits, shell commands, searches)
- File touch indicators
- Staggered animation timeline

### Aggregate Stats Banner
- Total sessions, lines touched, files changed
- Traces captured, average context usage
- Agent mode breakdown (Agent / Multitask / Chat)

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    AgentBoard UI                          │
│         Next.js 16 + Tailwind v4 + React 19              │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐        │
│  │ Active │  │ Today  │  │  Week  │  │ Older  │        │
│  └────────┘  └────────┘  └────────┘  └────────┘        │
└────────────────────────┬─────────────────────────────────┘
                         │
            ┌────────────┼────────────┐
            ▼            ▼            ▼
  ┌──────────────┐ ┌──────────┐ ┌───────────────────┐
  │ Cursor State │ │Transcript│ │ Session Tracer    │
  │ SQLite DB    │ │  .jsonl  │ │ MCP Server        │
  │ (titles,     │ │ files    │ │ (FastAPI + FastMCP)│
  │  metadata)   │ │          │ │ Port 8080         │
  └──────────────┘ └──────────┘ └───────────────────┘
```

---

## Quick Start

```bash
# Clone
git clone https://github.com/Sridhar1030/agentboard.git
cd agentboard

# Install & run
npm install
cp .env.example .env.local   # Add your CURSOR_API_KEY
npm run dev                   # → http://localhost:3000
```

### Enable Reasoning Traces (Optional)

AgentBoard integrates with [cursor-session-tracer](https://github.com/indranildchandra/cursor-session-tracer) for MCP-based reasoning capture:

```bash
# In a separate terminal
git clone https://github.com/indranildchandra/cursor-session-tracer.git
cd cursor-session-tracer
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn src.app:app --host 127.0.0.1 --port 8080
```

The `.cursor/mcp.json` auto-registers the tracer. Future agent sessions produce traces stored in `.cursor/traces/`.

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | Next.js 16, React 19, Tailwind v4 | Server components, streaming UI |
| Agent Metadata | SQLite introspection (`state.vscdb`) | Real titles, impact metrics — no heuristics |
| Transcripts | JSONL parsing | Full conversation history with tool calls |
| Tracing | cursor-session-tracer (FastAPI + FastMCP) | MCP-based reasoning chain capture |
| Protocol | Model Context Protocol (MCP) | Standard AI tool integration |
| SDK | @cursor/sdk | Programmatic agent operations |

---

## Trace Storage

Traces are stored locally:

```
.cursor/traces/
└── YYYYMMDD/
    └── <session-id>/
        └── HHMMSS_<slug>.json
```

Each trace file contains the full reasoning chain, file touches, model info, token counts, and cost estimates.

---

## Why This Matters

| Scenario | Without AgentBoard | With AgentBoard |
|---|---|---|
| Reviewing agent-generated PR | Stare at 40 changed files | Walk the reasoning trace step-by-step |
| Agent broke something 2 days ago | Binary search through git | Search by date, find which session touched that file |
| Measuring AI adoption | Anecdotal | Concrete: lines written, files changed, sessions/week |
| Budget planning | "We spend $X on AI" | Per-session cost with model/token breakdown |
| Team onboarding | "Just look at the code" | Browse sessions by project with full context |

---

## Key Insight

> The same way **OpenTelemetry** brought observability to microservices, we need an observability layer for AI agents. AgentBoard is that layer for AI-powered development.

This isn't monitoring — it's making agent work **auditable, reviewable, and measurable**.

---

## License

MIT

---

<p align="center"><i>Built with Cursor SDK, Model Context Protocol, and cursor-session-tracer.</i></p>
