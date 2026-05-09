# Slack Pitch Messages

Use these to pitch AgentBoard to your seniors. Pick the one that fits your audience best.

---

## Option 1: The Concise Technical Pitch (Recommended)

```
Hey team — built something over the weekend I think is worth a quick look.

*Problem:* We all use AI agents daily now, but there's no single place to see what they're doing across projects. How many sessions ran today? Which ones changed the most code? Which sessions consumed 80% of their context budget? If something breaks, which session touched that file 2 days ago?

*Solution:* AgentBoard — a real-time analytics dashboard for AI coding sessions.

What it does:
• Unified Kanban view of every agent session across all your projects (Active / Today / Week / Older)
• Per-session impact metrics — lines added/removed, files touched, context budget consumed
• Full conversation replay with tool call visualization (most recent first)
• Decision graph explorer — see the agent's step-by-step reasoning chain
• File heatmap — which parts of your codebase AI touches most
• Everything local — reads from Cursor's own state, nothing goes to the cloud

Tech: Next.js 16 + React 19 + Tailwind v4 + Cursor SDK + MCP
Repo: https://github.com/Sridhar1030/agentboard

Happy to do a 5-min demo if there's interest. Becomes more valuable as we scale agent usage across the team.
```

---

## Option 2: The Strategic / Leadership Pitch

```
Quick update on something I've been exploring around AI developer productivity.

As our team's usage of AI coding agents grows, I noticed we're missing a central view of what's happening. Right now each person's agent sessions disappear after the chat window closes — no history, no metrics, no way to search back through past sessions.

I built a POC called AgentBoard — an analytics dashboard for AI-assisted development:

1. *Unified View* — See every agent session across all projects in one Kanban board
2. *Impact Tracking* — Lines touched, files changed, context budget, session cost
3. *Conversation Replay* — Click any session → full replay with tool calls and file touches
4. *Decision Graphs* — Visual reasoning chains showing how the agent moved from prompt to implementation
5. *Search & Filter* — Find any session by project, title, or mode

Why this matters at scale: if 10 devs run 5 agent sessions/day, that's 50 black-box sessions daily producing code with no shared visibility. AgentBoard makes that searchable and reviewable.

Built on MCP (Model Context Protocol) — the open standard for AI tool integration, so it's not locked to any single IDE.

Repo: https://github.com/Sridhar1030/agentboard

Would love feedback. Happy to demo in the next sync.
```

---

## Option 3: The Casual / Excited Dev Pitch

```
yo, built something kinda cool this weekend

you know how you run a bunch of agent sessions and then forget what each one did? or something breaks and you can't figure out which session touched that file?

made a dashboard for it:
• all your cursor agent sessions in one kanban board
• click any card → see the full conversation replay with tool calls and file touches
• stats: lines changed, files touched, context usage per session
• decision graph view if you have tracing enabled
• search across everything — find that session from 3 days ago instantly

https://github.com/Sridhar1030/agentboard

the cool part: it reads directly from cursor's local state so there's zero setup. just npm install and it shows all your past sessions immediately. no config, no cloud, no sign-up.
```

---

## Option 4: For Engineering All-Hands / Demo Day

```
*AgentBoard: Dev Analytics for the AI-Assisted Era*

Context:
Our team runs dozens of AI agent sessions daily. Each session produces code changes, but the session itself — the decisions, the context consumed, the files read — disappears when the chat closes.

What I Built:
A real-time dashboard that surfaces all agent sessions across projects with:
• Impact metrics (lines touched, files changed, context budget)
• Conversation replay with tool call visualization
• Decision graph explorer for traced sessions
• Aggregate analytics (sessions/week, cost trends, most-touched files)

Why It Matters:
1. Debugging: instantly find which session touched a broken file
2. Measurement: quantify AI adoption impact with real numbers
3. Review: walk an agent's reasoning chain instead of guessing from a diff
4. Scale: works across all projects, all sessions, all devs

Tech: Next.js 16 / React 19 / Tailwind v4 / Cursor SDK / MCP Protocol
Demo: https://github.com/Sridhar1030/agentboard
```

---

## Tips for Pitching

1. **Lead with the problem**, not the solution. Everyone's experienced "WTF did the agent do?"
2. **Use the OpenTelemetry analogy** — it instantly communicates the concept to anyone who's worked with distributed systems
3. **Show, don't tell** — run the dashboard live and click into a real trace during a demo
4. **Mention scale** — "This matters more as we go from 1 dev using agents to 10"
5. **Keep it local-first** — emphasize that traces are stored locally, no data leaves the machine
