import { Agent, CursorAgentError } from "@cursor/sdk";

import { COACH_ANALYSIS_USER_WINDOW } from "./promptCoachConstants";

export type CoachGrade = "A" | "B" | "C" | "D";

export interface CorrectionMoment {
  turnIndex: number;
  text: string;
  reason: string;
}

export interface PromptCoachAnalysis {
  grade: CoachGrade;
  idealPrompt: string;
  tips: string[];
  summary: string;
  wastedTurns: number;
  productiveTurns: number;
  totalTurns: number;
  efficiency: number;
  correctionMoments: CorrectionMoment[];
  avgWordsPerMessage: number;
  /** True when Cursor SDK did not supply the narrative fields (or we fell back). */
  usedHeuristicNarrative: boolean;
}

/** API payload for `/api/agents/[id]/coach` (includes transport metadata). */
export interface CoachApiResponse extends PromptCoachAnalysis {
  agentId: string;
  error?: string;
  sdkCoachAttempted: boolean;
  sdkCoachSucceeded: boolean;
}

const CORRECTION_START =
  /^(no\b|nope\b|not\b|wrong\b|actually\b|i meant\b|wait\b|sorry\b|hm+\b|hmm\b|that'?s wrong|that'?s not|not that|instead\b|rather\b|undo\b|revert\b|don'?t\b|stop\b|hold on\b|no\s*[,.]|make it more|make this|change it|still not|that'?s not what)/i;

const CORRECTION_PHRASE =
  /(that'?s not what i asked|not what i wanted|you misunderstood|not quite right|almost there|try again|that'?s incorrect)/i;

const VAGUE_SUPERLATIVES =
  /\b(make it (nice|pretty|better|cleaner)|looks? (bad|off|wrong)|just fix it|fix this|do the thing|should work|obviously|obvious)\b/i;

const SPECIFICITY_HINTS =
  /\b(file|path|route|component|tsx?|css|tailwind|test|jest|api|endpoint|error:|stack|mobile|desktop|breakpoint|pixel|px|rem|a11y|dark mode|responsive|acceptance|criteria)\b/i;

function cleanTranscriptText(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordCount(text: string): number {
  if (!text.trim()) return 0;
  return text.trim().split(/\s+/).length;
}

function normalizeWords(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function wordOverlapSimilarity(a: string, b: string): number {
  const wa = new Set(normalizeWords(a).split(" ").filter(Boolean));
  const wb = new Set(normalizeWords(b).split(" ").filter(Boolean));
  if (wa.size === 0 && wb.size === 0) return 1;
  let inter = 0;
  for (const w of wa) if (wb.has(w)) inter++;
  return (2 * inter) / (wa.size + wb.size);
}

function isCorrectionLike(text: string, prevUser: string | undefined): boolean {
  const t = text.trim();
  if (!t) return false;
  if (CORRECTION_START.test(t) || CORRECTION_PHRASE.test(t)) return true;
  if (prevUser && wordOverlapSimilarity(t, prevUser) >= 0.78 && wordCount(t) <= Math.max(wordCount(prevUser) * 1.2, 12))
    return true;
  return false;
}

function heuristicGrade(efficiency: number, avgWords: number, correctionRatio: number): CoachGrade {
  if (efficiency >= 0.82 && avgWords >= 22 && correctionRatio < 0.2) return "A";
  if (efficiency >= 0.6 && correctionRatio < 0.45) return "B";
  if (efficiency >= 0.4) return "C";
  return "D";
}

function buildIdealPromptFromMessages(messages: string[]): string {
  const merged = messages
    .map((m) => m.trim())
    .filter(Boolean)
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n");

  const lines = merged.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const deduped: string[] = [];
  for (const line of lines) {
    const last = deduped[deduped.length - 1];
    if (last && wordOverlapSimilarity(line, last) > 0.92) continue;
    deduped.push(line);
  }
  const out = deduped.join(" ").replace(/\s+/g, " ").trim();
  return out || "(No user text found in transcript.)";
}

function buildHeuristicTips(params: {
  correctionRatio: number;
  avgWords: number;
  vagueHits: boolean;
  specificityHits: boolean;
  shortFollowups: number;
  repeating: number;
}): string[] {
  const tips: string[] = [];
  if (params.vagueHits) {
    tips.push(
      "Next time, try replacing phrases like ‘nice’ or ‘better’ with concrete UI rules: layout, spacing, typography scale, and dark/light behavior."
    );
  }
  if (params.correctionRatio > 0.25) {
    tips.push(
      "Next time, try stating success criteria up front — what ‘done’ looks like, edge cases, and what not to change."
    );
  }
  if (params.shortFollowups > 0) {
    tips.push(
      "Short follow-up pings often mean missing constraints. Next time, try bundling stack, files, and acceptance checks into one message."
    );
  }
  if (!params.specificityHits && params.avgWords < 35) {
    tips.push(
      "Next time, try naming the target area: routes, components, APIs, or error messages you care about."
    );
  }
  if (params.repeating > 0) {
    tips.push(
      "You revisited the same ask a few times — next time, try one consolidated prompt with numbered requirements."
    );
  }
  if (tips.length === 0) {
    tips.push("Next time, try keeping this clarity — specific files plus expected outcomes reduce rework.");
    tips.push(
      "If something is out of scope, mention it explicitly so the agent doesn’t optimize the wrong surface."
    );
  }
  return tips.slice(0, 4);
}

export function analyzeTranscriptHeuristic(jsonl: string): PromptCoachAnalysis {
  const lines = jsonl.split("\n").filter(Boolean);
  return rewalkTranscript(lines);
}

const COACH_SDK_USER_MESSAGES = 18;
const MAX_SDK_MESSAGE_CHARS = 1200;

function truncateForSdk(text: string): string {
  if (text.length <= MAX_SDK_MESSAGE_CHARS) return text;
  return `${text.slice(0, MAX_SDK_MESSAGE_CHARS)}…`;
}

function rewalkTranscript(lines: string[]): PromptCoachAnalysis {
  const userMessages: string[] = [];
  const cameAfterAssistant: boolean[] = [];
  let prevRole: "user" | "assistant" | "none" = "none";

  for (const line of lines) {
    let entry: { role?: string; message?: { content?: Array<{ type?: string; text?: string }> } };
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    let rawText = "";
    for (const block of entry.message?.content || []) {
      if (block.type === "text" && typeof block.text === "string") rawText += block.text;
    }
    const text = cleanTranscriptText(rawText);

    if (entry.role === "user" && text) {
      cameAfterAssistant.push(prevRole === "assistant");
      userMessages.push(text);
      prevRole = "user";
    } else if (entry.role === "assistant" || entry.role === "tool") {
      prevRole = "assistant";
    }
  }

  const totalTurnsAll = userMessages.length;
  const windowStart = Math.max(0, userMessages.length - COACH_ANALYSIS_USER_WINDOW);

  const correctionMoments: CorrectionMoment[] = [];
  let wasted = 0;
  let shortFollowups = 0;
  let repeating = 0;
  let vagueHits = false;
  let specificityTokenHits = 0;

  for (let gi = windowStart; gi < userMessages.length; gi++) {
    const text = userMessages[gi]!;
    if (VAGUE_SUPERLATIVES.test(text)) vagueHits = true;
    if (SPECIFICITY_HINTS.test(text)) specificityTokenHits++;

    const wc = wordCount(text);

    if (gi > 0) {
      const prevUserText = userMessages[gi - 1]!;
      let wastedThis = false;
      let reason = "";

      if (isCorrectionLike(text, prevUserText)) {
        wastedThis = true;
        reason = "Sounds like a correction or clarification.";
      } else if (cameAfterAssistant[gi] && wc < 20) {
        wastedThis = true;
        reason = "Short ping right after the agent — often a tweak; try folding details into your first prompt.";
        shortFollowups++;
      } else if (wordOverlapSimilarity(text, prevUserText) >= 0.78) {
        wastedThis = true;
        reason = "Very similar to your last message — consider merging into one clear prompt.";
        repeating++;
      }

      if (wastedThis) {
        wasted++;
        correctionMoments.push({ turnIndex: gi, text: text.slice(0, 320), reason });
      }
    }
  }

  const windowTurns = userMessages.length - windowStart;
  const productiveTurns = Math.max(0, windowTurns - wasted);
  const efficiency = windowTurns > 0 ? productiveTurns / windowTurns : 1;
  const windowSlice = userMessages.slice(windowStart);
  const totalWords = windowSlice.reduce((s, m) => s + wordCount(m), 0);
  const avgWordsPerMessage = windowTurns > 0 ? totalWords / windowTurns : 0;
  const correctionRatio = windowTurns > 0 ? wasted / windowTurns : 0;

  const grade = heuristicGrade(efficiency, avgWordsPerMessage, correctionRatio);
  const tips = buildHeuristicTips({
    correctionRatio,
    avgWords: avgWordsPerMessage,
    vagueHits,
    specificityHits: specificityTokenHits > 0,
    shortFollowups,
    repeating,
  });

  let summary = "";
  if (totalTurnsAll === 0) {
    summary = "No user messages were found in this transcript.";
  } else if (efficiency >= 0.75) {
    summary =
      "Your prompts stayed focused — most turns looked like new information rather than damage control.";
  } else if (efficiency >= 0.45) {
    summary = "There was some back-and-forth — a richer first prompt might have reduced the extra turns.";
  } else {
    summary =
      "Several turns looked like corrections or quick follow-ups. Bundling constraints earlier usually helps.";
  }
  if (totalTurnsAll > COACH_ANALYSIS_USER_WINDOW) {
    summary += ` Efficiency signals reflect your last ${COACH_ANALYSIS_USER_WINDOW} user messages (of ${totalTurnsAll} total).`;
  }

  return {
    grade,
    idealPrompt: buildIdealPromptFromMessages(userMessages.slice(-COACH_ANALYSIS_USER_WINDOW)),
    tips,
    summary,
    wastedTurns: wasted,
    productiveTurns,
    totalTurns: totalTurnsAll,
    efficiency,
    correctionMoments,
    avgWordsPerMessage,
    usedHeuristicNarrative: true,
  };
}

interface SdkCoachPayload {
  grade?: string;
  idealPrompt?: string;
  tips?: string[];
  wastedTurns?: number;
  totalTurns?: number;
  summary?: string;
}

function parseJsonFromModelOutput(s: string): SdkCoachPayload | null {
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fence ? fence[1]! : s;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as SdkCoachPayload;
  } catch {
    return null;
  }
}

function isCoachGrade(g: string): g is CoachGrade {
  return g === "A" || g === "B" || g === "C" || g === "D";
}

/** Trim payload sent to the Cursor API (no assistant transcript text). */
export interface SdkCoachTranscriptContext {
  totalUserTurns: number;
  recentForSdk: Array<{ text: string; followingUserWasCorrection: boolean }>;
}

/** Builds a small, token-efficient view for SDK enrichment. */
export function buildSdkCoachContext(jsonl: string): SdkCoachTranscriptContext {
  const all = extractUserMessagesChronological(jsonl);
  const slice = all.slice(-COACH_SDK_USER_MESSAGES);
  const offset = all.length - slice.length;
  const recentForSdk = slice.map((text, i) => {
    const gi = offset + i;
    const followingUserWasCorrection =
      gi < all.length - 1 ? isCorrectionLike(all[gi + 1]!, all[gi]!) : false;
    return {
      text: truncateForSdk(text),
      followingUserWasCorrection,
    };
  });
  return { totalUserTurns: all.length, recentForSdk };
}

export async function enrichWithSdkCoach(
  base: PromptCoachAnalysis,
  context: SdkCoachTranscriptContext,
  cwd: string,
  apiKey: string
): Promise<PromptCoachAnalysis> {
  const recentJson = JSON.stringify(context.recentForSdk);
  const prompt = `You are a friendly "prompt coach" for developers using AI coding assistants.

This conversation had ${context.totalUserTurns} user turns total.

The JSON below lists the last ${context.recentForSdk.length} user messages (chronological). For each entry, followingUserWasCorrection means the next user turn looked like a correction/clarification relative to that turn (heuristic); there are no assistant messages in this payload.

${recentJson}

Heuristic stats from the app (recent window; refine but do not contradict wildly): grade≈${base.grade}, wastedTurns≈${base.wastedTurns}, totalTurns≈${base.totalTurns}, efficiency≈${base.efficiency.toFixed(2)}.

Respond with ONLY valid JSON (no markdown prose outside the JSON object) using this shape:
{"grade":"A"|"B"|"C"|"D","idealPrompt":"string","tips":["string",...],"wastedTurns":number,"totalTurns":number,"summary":"one encouraging sentence"}

Use totalTurns=${context.totalUserTurns} for the full conversation. Use an encouraging tone ("Next time, try..." not harsh blame). idealPrompt should be ONE consolidated first message that would have reduced back-and-forth.`;

  try {
    const run = await Agent.prompt(prompt, {
      apiKey,
      model: { id: "composer-2" },
      local: { cwd, settingSources: [] },
    });

    if (run.status !== "finished" || !run.result) {
      return base;
    }

    const parsed = parseJsonFromModelOutput(run.result);
    if (!parsed) return base;

    const out: PromptCoachAnalysis = { ...base, usedHeuristicNarrative: false };

    if (parsed.grade && isCoachGrade(parsed.grade)) out.grade = parsed.grade;
    if (typeof parsed.idealPrompt === "string" && parsed.idealPrompt.trim()) out.idealPrompt = parsed.idealPrompt.trim();
    if (Array.isArray(parsed.tips)) {
      const t = parsed.tips.filter((x) => typeof x === "string" && x.trim()).slice(0, 5);
      if (t.length > 0) out.tips = t.map((x) => x.trim());
    }
    if (typeof parsed.summary === "string" && parsed.summary.trim()) out.summary = parsed.summary.trim();
    if (typeof parsed.totalTurns === "number" && Number.isFinite(parsed.totalTurns) && parsed.totalTurns >= 0)
      out.totalTurns = Math.round(parsed.totalTurns);
    if (typeof parsed.wastedTurns === "number" && Number.isFinite(parsed.wastedTurns) && parsed.wastedTurns >= 0) {
      const maxW = out.totalTurns;
      out.wastedTurns = Math.min(Math.max(0, Math.round(parsed.wastedTurns)), maxW);
    }

    const pt = Math.max(0, out.totalTurns - out.wastedTurns);
    out.productiveTurns = pt;
    out.efficiency = out.totalTurns > 0 ? pt / out.totalTurns : 1;

    return out;
  } catch (err) {
    if (err instanceof CursorAgentError) {
      return base;
    }
    return base;
  }
}

export function extractUserMessagesChronological(jsonl: string): string[] {
  const lines = jsonl.split("\n").filter(Boolean);
  const out: string[] = [];
  for (const line of lines) {
    let entry: { role?: string; message?: { content?: Array<{ type?: string; text?: string }> } };
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (entry.role !== "user") continue;
    let rawText = "";
    for (const block of entry.message?.content || []) {
      if (block.type === "text" && typeof block.text === "string") rawText += block.text;
    }
    const text = cleanTranscriptText(rawText);
    if (text) out.push(text);
  }
  return out;
}
