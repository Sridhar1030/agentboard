# AgentBoard — Product Roadmap

## Recently shipped

These are in the product today:

| Capability | Notes |
|---|---|
| **Prompt Coach** | Grades prompts (A–D), suggests an **ideal prompt**, surfaces **correction patterns**, and combines **fast heuristics** with optional **Cursor SDK** narrative refinement. **Disk cache** (keyed on transcript mtime/size) avoids repeat API spend on unchanged sessions. |
| **Workspace-aware session tracing** | MCP **start_trace** accepts a **workspace** root path; trace JSON carries that field so AgentBoard can match traces to the correct Cursor project instead of guessing from titles alone. |
| **Full agent page** (`/agent/[id]`) | Dedicated session view with **activity**, **reasoning DAG** (`TraceDagSvg`), **files**, and **Prompt Coach** tabs. |
| **Insights redesign** | Cross-session **directory hotspots**, **co-mod pairs**, **file activity timeline**, filtered by workspace and agent/trace context. |

## What's next

Ideas organized by impact and effort. Each tier builds on the previous.

### Tier 1: Ship This Week

#### 1. Git Blame ↔ Trace Linking
**What:** Automatically link git commits to the agent session that produced them.
**How:** When a trace ends, record the git diff hash. In the UI, show "This commit was produced by session X" and vice versa.
**Why it's exciting:** Closes the loop between "what changed" (git) and "why it changed" (trace). Reviewers can click from a PR diff directly into the reasoning chain.

---

#### 2. Session Replay / Playback Mode
**What:** A "replay" button that animates through the trace like a recording — showing each decision unfolding in real-time with proper timing.
**How:** Use the timestamps between steps to create a timed animation. Each step fades in with its reasoning, files flash as they're touched.
**Why it's exciting:** Like watching a senior dev explain their thought process. Perfect for onboarding, learning, and demos.

---

#### 3. Cost Intelligence Dashboard
**What:** Track token spend and cost per session, per project, per week. Show trends, anomalies, and budget projections.
**How:** The tracer already captures `tokens_in`, `tokens_out`, `cost_usd`. Aggregate over time with charts.
**Why it's exciting:** Answers "are we spending more on AI this month?" and "which projects burn the most tokens?" — critical for budget-conscious teams.

---

#### 4. Agent Diff View
**What:** For each session, show a unified diff of all files before/after the agent ran — directly in the dashboard.
**How:** Capture git state at trace start and end. Render a side-by-side diff viewer (monaco-diff or similar).
**Why it's exciting:** No need to switch to git. See exactly what the agent produced alongside its reasoning.

---

#### 5. Trace-Aware Code Search
**What:** "Which agent sessions touched this file?" — search across all traces by file path, function name, or pattern.
**How:** Index all `files_read`, `files_modified`, `files_created` across traces. Full-text search on reasoning text.
**Why it's exciting:** When something breaks, instantly find which session(s) touched that area of code.

---

#### Session Efficiency Scoring *(planned — next after Prompt Coach)*
**What:** Quantitative **session quality** scores from trace + transcript signals — branching depth, file churn, step density, outcome-to-effort ratios, alignment with Prompt Coach grades.
**How:** Aggregate MCP trace JSON (event DAG, `files_read` / `files_modified`, reasoning steps, `end_trace` stats) and optional coach outputs into **per-session** and **rollup** scores in the UI.
**Why it's exciting:** Objectively compare runs, spot wasted backtracking, and show improvement over time — extending what Prompt Coach explains qualitatively into **metrics**.
**Relationship:** Prompt Coach (shipped) already surfaces **productive vs. wasted turns** and **grades**; efficiency scoring generalizes that into dashboard-level KPIs.

---

### Tier 2: High Impact, Medium Effort

#### 6. Team Aggregation (Multi-User)
**What:** Collect traces from multiple team members into a shared view. See who's using agents for what, across the whole team.
**How:** Simple trace-sync service (POST traces to a shared endpoint). Each trace includes user ID.
**Why it's exciting:** Goes from "my dashboard" to "team observability." Managers can see adoption patterns, identify training needs, and track team productivity.

---

#### 7. Anomaly Detection / Alert Rules
**What:** Flag sessions that look "off" — unusually high token spend, many abandoned sessions, repeated file modifications (agent looping), or sessions that touch critical files.
**How:** Define rules like "alert if cost > $1" or "alert if same file modified > 5 times in one session." Push to Slack.
**Why it's exciting:** Catch expensive mistakes early. Know when an agent is spinning its wheels before it burns through your context budget.

---

#### 8. PR Integration (GitHub Action)
**What:** A GitHub Action that attaches the reasoning trace link to every agent-generated PR as a comment.
**How:** During `end_trace`, if a branch is active, push trace metadata to a known location. GH Action reads it and posts a formatted comment.
**Why it's exciting:** Reviewers get context without leaving GitHub. PRs become self-documenting.

---

#### 9. Session Comparison / A/B Testing
**What:** Compare two agent sessions side-by-side — same prompt with different models, or same task with different approaches.
**How:** Split-view UI showing both traces simultaneously. Highlight differences in decisions and outcomes.
**Why it's exciting:** Finally answer "Is GPT-4 or Claude better for refactoring tasks?" with actual data instead of vibes.

---

#### 10. Knowledge Graph (Neo4j Integration)
**What:** Store traces in a graph database. Query relationships like "which decisions led to this file being modified?" or "across all sessions, what do agents read before modifying the auth module?"
**How:** Export trace events as graph nodes/edges → Neo4j. Build a visual graph explorer.
**Why it's exciting:** Cross-session intelligence. Discover patterns like "agents always read X before modifying Y" — could improve prompting strategies.

---

### Tier 3: Visionary / Research-Grade

#### 11. Automatic Quality Scoring
**What:** Rate each session's output quality based on signals: did tests pass after? Were changes reverted? Did a human edit the agent's output?
**How:** Post-session hooks that check `git log` for follow-up commits, `npm test` results, etc. Score as green/yellow/red.
**Why it's exciting:** Objective measurement of agent quality. Track whether quality improves over time.

---

#### 12. Predictive Context Budgeting
**What:** Before starting a task, estimate how much context it'll consume based on historical traces for similar tasks.
**How:** ML model trained on past traces — input: task description + file count → output: predicted context usage, token count, cost.
**Why it's exciting:** "This task will likely need 85% context and cost ~$0.45. Split into subtasks?" — proactive guidance before you start.

---

#### 13. Agent-to-Agent Handoff Visualization
**What:** When agents spawn subagents, show the full tree of delegated work — parent → child relationships with data flow.
**How:** Extend traces to capture `numSubComposers` depth. Render as a tree/graph with expandable subtrees.
**Why it's exciting:** As agent architectures get more complex (orchestrator → specialist agents), you need visibility into the full delegation chain.

---

#### 14. Codebase Impact Heatmap Over Time
**What:** Animated heatmap showing which parts of the codebase agents touch most, evolving over days/weeks.
**How:** Aggregate file paths from all traces, weighted by recency. Render as a treemap or flame chart.
**Why it's exciting:** Reveals "hot zones" — areas agents work in most. Could indicate complexity (needs refactoring) or active development areas.

---

#### 15. Natural Language Trace Queries
**What:** Ask questions in English: "What did agents do to the auth module last week?" or "Which sessions had errors?"
**How:** RAG over trace data — embed reasoning text + file paths, query with natural language.
**Why it's exciting:** No need to learn the UI. Just ask what you want to know. Like having a teammate who remembers everything every agent ever did.

---

## Implementation Priority Matrix

| Feature | Impact | Effort | Priority |
|---|---|---|---|
| Git Blame ↔ Trace Linking | High | Low | P0 |
| Session Replay | High | Low | P0 |
| Cost Intelligence | High | Low | P0 |
| Agent Diff View | High | Medium | P1 |
| Trace-Aware Search | High | Medium | P1 |
| Session Efficiency Scoring | High | Medium | P1 |
| PR Integration (GH Action) | High | Medium | P1 |
| Team Aggregation | Very High | Medium | P1 |
| Anomaly Detection | Medium | Medium | P2 |
| Session Comparison | Medium | Medium | P2 |
| Knowledge Graph | High | High | P2 |
| Quality Scoring | High | High | P3 |
| Predictive Budgeting | Medium | High | P3 |
| Subagent Visualization | Medium | Medium | P3 |
| Codebase Heatmap | Medium | Medium | P3 |
| NL Trace Queries | Very High | High | P3 |

---

## Design Principles

1. **Local-first** — Your data stays on your machine. No accounts, no cloud sync, no privacy concerns.
2. **Zero-config** — Works immediately by reading from Cursor's existing local state. No setup step.
3. **Additive** — Each feature is opt-in. The dashboard works without tracing. Tracing works without the dashboard.
4. **Protocol-open** — Built on MCP so it's not locked to Cursor. Any compatible IDE could produce data for it.
5. **Developer-first** — Built by someone who uses agents 8+ hours/day and needed this tool to exist.
