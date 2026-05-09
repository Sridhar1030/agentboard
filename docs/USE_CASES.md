# AgentBoard — Use Cases

## Overview

AgentBoard is a developer analytics dashboard that answers the question: "What are my AI assistants actually doing across my projects?" Below are concrete scenarios organized by who benefits.

---

## For Individual Developers

### 1. "What did my agent just do?"

**Scenario:** You kicked off an agent task, went for coffee, came back to 40 files changed.

**Without AgentBoard:** Manually diff each file, guess why the agent refactored something, hope it makes sense.

**With AgentBoard:** Open the session card → see the reasoning trace step-by-step:
- Step 1: "Read auth.py to understand current pattern"
- Step 2: "Decided to replace APIKeyAuth with BearerToken because..."
- Step 3: "Modified 3 dependent files that import from auth.py"

You instantly understand the *why* behind every change.

---

### 2. "Which agent broke this?"

**Scenario:** A test that passed yesterday now fails. Multiple agent sessions ran over the past 24 hours.

**Without AgentBoard:** `git log --since=yesterday`, manually inspect each commit, figure out which was agent-generated.

**With AgentBoard:** 
- Search by file name in AgentBoard
- See every agent session that touched that file
- Click into the session → see what the agent read, what it decided, and what it modified
- Identify the exact session and reasoning that introduced the regression

---

### 3. "Am I burning too much context?"

**Scenario:** Your agent sessions keep hitting context limits and producing incomplete work.

**Without AgentBoard:** No visibility. You just notice the output quality drops.

**With AgentBoard:** The stats banner shows average context usage across sessions. Click into individual sessions to see which ones consumed 80%+ context. Identify patterns — maybe certain types of tasks need to be broken into smaller chunks.

---

### 4. "Walk the DAG" when reasoning looks wrong

**Scenario:** An agent produced a surprising refactor. Plain chat shows *what* it said, not the full order of decisions.

**With AgentBoard:** Open **Trace Explorer** (`/traces`) or the **Traces** tab on a session — the decision **DAG** lays out each step as a node with parent/child links. Follow branches where the model chose a different path, see which files were read before a write, and align timestamps with the transcript. Same graph appears when you link from a kanban session into a related trace.

**Outcome:** You debug *reasoning structure* (missed steps, wrong fork, noisy backtracking), not just final diffs — similar to stepping through a program's control flow.

---

### 5. "Are my prompts any good?"

**Scenario:** You run agents daily but output quality feels random — unclear instructions, long back-and-forth, or repeated corrections after the model misunderstood.

**Without AgentBoard:** You rely on gut feel or re-read long threads manually.

**With AgentBoard — Prompt Coach** (`/agent/[id]` → **Coach** tab):
- **Letter grade (A–D)** from transcript structure (productive vs. wasted turns, verbosity patterns).
- A concise **summary** of how the conversation *actually* went vs. what you intended.
- An **ideal prompt** — a single tight instruction you could have used to reduce churn.
- **Correction moments** when you had to steer the agent back on track (pattern detection).

Optional **Cursor SDK** pass refines the narrative when `CURSOR_API_KEY` is set; **disk caching** means you are not re-charged for the same transcript on every refresh.

**Outcome:** You improve *how* you drive the agent — the highest-leverage habit change for AI-assisted development.

---

## For Tech Leads / Managers

### 6. Measuring AI Adoption Impact

**Scenario:** Leadership asks "How much value are we getting from AI coding tools?"

**Without AgentBoard:** Anecdotal. "We think it saves time."

**With AgentBoard:**
- **Quantitative:** 26.7k lines touched, 145 files changed, 138 sessions this month
- **Qualitative:** Agent mode breakdown (Agent: 88%, Multitask: 8%, Chat: 4%)
- **Cost:** Per-session token/cost tracking shows ROI
- **Trend:** Session frequency increasing week-over-week = organic adoption

---

### 7. Code Review of Agent-Generated PRs

**Scenario:** A PR shows 600 lines changed across 12 files. It was agent-generated.

**Without AgentBoard:** Reviewer stares at the diff, guesses the intent, maybe asks the author.

**With AgentBoard:** The trace link in the PR shows:
- What the agent was told to do (the prompt)
- What it read to understand the codebase
- Each decision point with natural-language reasoning
- Which files it modified and why

Review time drops from 45 minutes to 10 minutes.

---

### 8. Onboarding New Team Members

**Scenario:** New hire needs to understand how a complex feature was built.

**Without AgentBoard:** "Look at the git history and read the code."

**With AgentBoard:** Browse agent sessions by project → see the reasoning traces for the entire feature build. It's like having a narrated recording of the development process.

---

## For Platform / DevEx Teams

### 9. Understanding Agent Patterns Across the Org

**Scenario:** DevEx team wants to improve developer productivity with AI tools.

**With AgentBoard:**
- Which projects use agents most?
- What types of tasks are agents doing? (refactoring, feature building, bug fixing)
- Where do agents struggle? (high context usage, abandoned sessions)
- What's the average session cost? Are some patterns more expensive than others?

---

### 10. Debugging MCP Tool Integrations

**Scenario:** A custom MCP tool isn't working as expected during agent sessions.

**With AgentBoard:** The reasoning trace shows exactly when the agent called the tool, what input it provided, and how it interpreted the result. You can debug the tool behavior without reproducing the entire session.

---

## For Compliance / Security

### 11. Audit Trail for AI-Generated Code

**Scenario:** Regulated industry requires traceability for code changes.

**Without AgentBoard:** Git blame shows a commit, but can't explain the AI's decision process.

**With AgentBoard:** Each session trace provides a complete audit trail:
- What prompted the change
- What context the AI consumed
- What decisions it made and why
- Which files were read vs. modified
- Model used, token count, cost

This creates a defensible record of AI-assisted development.

---

## Summary Table

| Use Case | Persona | Key Benefit |
|---|---|---|
| Prompt quality (Prompt Coach) | Developer | Grade + ideal prompt + correction patterns; fewer wasted turns |
| DAG reasoning debug | Developer | See decision order and branches, not only the diff |
| Understand agent changes | Developer | Save 30+ min of manual investigation |
| Find regression source | Developer | Pinpoint exact session that broke things |
| Monitor context usage | Developer | Prevent quality degradation |
| Measure AI impact | Manager | Quantitative adoption metrics |
| Review agent PRs | Tech Lead | 4x faster code review |
| Onboard team members | New Hire | Narrated development history |
| Org-wide patterns | DevEx | Data-driven tooling decisions |
| Debug MCP tools | Platform | Reproduce and fix tool issues |
| Audit trail | Compliance | Defensible AI code traceability |
