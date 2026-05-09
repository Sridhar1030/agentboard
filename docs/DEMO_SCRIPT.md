# Demo Script (5 Minutes)

Use this script when presenting AgentBoard to your team.

---

## Setup (Before Demo)

1. Have `npm run dev` running (`localhost:3000`)
2. Have the tracer running (`uvicorn src.app:app --host 127.0.0.1 --port 8080`)
3. Have at least one active agent session producing traces
4. Open browser to `http://localhost:3000`

---

## The Hook (30 seconds)

> "Quick question — when an AI agent changes 40 files in your repo, how do you figure out WHY it made those specific choices? You can't. Git tells you what changed. But the reasoning is gone the moment the chat closes. I built something to fix that."

---

## Part 1: The Dashboard (90 seconds)

> "This is AgentBoard. It shows every AI agent session I've run across all my projects."

**Show:**
- Point to the Kanban columns: Active / Today / This Week / Older
- Point to the stats banner: "138 sessions, 26k lines touched, 145 files changed"
- Click a card to show the detail panel
- Highlight: lines added/removed, context usage, turns count

> "I can see at a glance which sessions had the most impact. This one touched 42 files and used 52% of its context budget."

---

## Part 2: The Reasoning Trace (120 seconds)

> "But the real value is this — the reasoning trace."

**Navigate to `/traces`:**
- Click on a trace session in the sidebar
- Show the Decision Graph view
- Click on a node to expand it

> "Each node is a decision the agent made. It shows:
> - WHAT it decided to do
> - WHY it chose that approach
> - WHICH files it read to inform that decision
> - WHICH files it modified as a result
> 
> This is like having a flight recorder for agent sessions."

**Switch to File Heatmap:**
> "And this shows which files the agent touched most. Read vs. Write vs. Create."

---

## Part 3: The Scale Argument (60 seconds)

> "Right now it's just me. But imagine this across the whole team:
> - 10 devs × 5 agent sessions per day = 50 sessions
> - Without this, that's 50 black boxes per day producing code with no reasoning trail
> - With this, every decision is captured, searchable, and reviewable
> 
> It's like adding OpenTelemetry to your AI workflow. The same way we'd never run production services without observability, we shouldn't run AI agents without it either."

---

## Part 4: How It Works (30 seconds)

> "It's built on MCP — the Model Context Protocol — which is the emerging standard for AI tool integration. So it's not locked to Cursor. Any MCP-compatible agent can produce these traces.
>
> Traces are stored locally in `.cursor/traces/`. No data leaves your machine. Zero config — just add a rule file and the traces generate automatically."

---

## Close (30 seconds)

> "I think as we scale AI usage across the team, having this observability layer becomes as important as having CI/CD. Happy to walk anyone through the setup if they want to try it."

---

## Anticipated Questions & Answers

**Q: Does this slow down the agent?**
A: No. The tracer is a separate MCP server. Appending a trace step is a single HTTP call that takes <10ms.

**Q: Does it work with other AI tools?**
A: The tracing part works with any MCP-compatible tool. The dashboard currently reads from Cursor's local state, but the trace format is tool-agnostic.

**Q: Where is data stored?**
A: Everything is local. Agent metadata comes from Cursor's SQLite DB on your machine. Traces are JSON files in `.cursor/traces/`. Nothing goes to the cloud.

**Q: How much storage do traces use?**
A: Each trace is 2-10KB of JSON. Even with 100 sessions/week, that's <1MB/week.

**Q: Can this be used for performance reviews / measuring developer productivity?**
A: It shows agent activity, not developer performance. An agent touching more files doesn't mean better work. It's a debugging and auditing tool, not a surveillance tool.
