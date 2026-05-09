import { readdir, readFile, stat } from "fs/promises";
import { execSync } from "child_process";
import { join } from "path";
import type {
  ConversationEntry,
  ConversationToolCall,
  FileTouch,
} from "@/types/conversation";

const PROJECTS_DIR = join(
  process.env.HOME || "/Users/srpillai",
  ".cursor",
  "projects"
);

const GLOBAL_STATE_DB = join(
  process.env.HOME || "/Users/srpillai",
  "Library",
  "Application Support",
  "Cursor",
  "User",
  "globalStorage",
  "state.vscdb"
);

export interface AgentData {
  id: string;
  name: string;
  subtitle: string;
  project: string;
  projectPath: string;
  workspace: string;
  lastModified: number;
  createdAt: number;
  mode: string;
  linesAdded: number;
  linesRemoved: number;
  filesChanged: number;
  contextUsage: number;
  isArchived: boolean;
  numSubComposers: number;
  status: "active" | "recent" | "idle" | "old";
  hasTranscript: boolean;
  turns: number;
}

function getStatus(lastModified: number): AgentData["status"] {
  const now = Date.now();
  const diff = now - lastModified;
  const ONE_HOUR = 60 * 60 * 1000;
  const ONE_DAY = 24 * ONE_HOUR;
  const ONE_WEEK = 7 * ONE_DAY;

  if (diff < ONE_HOUR) return "active";
  if (diff < ONE_DAY) return "recent";
  if (diff < ONE_WEEK) return "idle";
  return "old";
}

function extractWorkspaceName(workspace: unknown): { project: string; projectPath: string; workspacePath: string } {
  const w = workspace as { uri?: { path?: string } } | null | undefined;
  if (!w?.uri?.path) {
    return { project: "Unknown", projectPath: "", workspacePath: "" };
  }
  const wsPath = w.uri.path;
  const parts = wsPath.split("/");
  const folderName = parts[parts.length - 1] || parts[parts.length - 2] || "Unknown";
  return {
    project: folderName.replace(/_/g, " ").replace(/-/g, " "),
    projectPath: wsPath,
    workspacePath: wsPath,
  };
}

interface ComposerHeader {
  type: string;
  composerId: string;
  name?: string;
  lastUpdatedAt?: number;
  createdAt?: number;
  unifiedMode?: string;
  forceMode?: string;
  contextUsagePercent?: number;
  totalLinesAdded?: number;
  totalLinesRemoved?: number;
  filesChangedCount?: number;
  subtitle?: string;
  isArchived?: boolean;
  numSubComposers?: number;
  workspaceIdentifier?: unknown;
}

function queryComposerHeaders(): ComposerHeader[] {
  try {
    const raw = execSync(
      `sqlite3 "${GLOBAL_STATE_DB}" "SELECT value FROM ItemTable WHERE key = 'composer.composerHeaders';"`,
      { encoding: "utf-8", timeout: 5000 }
    );
    const data = JSON.parse(raw);
    return data.allComposers || [];
  } catch {
    return [];
  }
}

function findTranscriptInfo(composerId: string): { projectPath: string; turns: number } | null {
  // We'll cache this lookup
  return transcriptCache.get(composerId) || null;
}

const transcriptCache = new Map<string, { projectPath: string; turns: number }>();
let transcriptCacheBuilt = false;

async function buildTranscriptCache() {
  if (transcriptCacheBuilt) return;
  transcriptCacheBuilt = true;

  let projectDirs: string[] = [];
  try {
    const entries = await readdir(PROJECTS_DIR, { withFileTypes: true });
    projectDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return;
  }

  for (const projectName of projectDirs) {
    const transcriptsDir = join(PROJECTS_DIR, projectName, "agent-transcripts");
    let agentDirs: string[];
    try {
      const entries = await readdir(transcriptsDir, { withFileTypes: true });
      agentDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
    } catch {
      continue;
    }

    for (const agentId of agentDirs) {
      const jsonlPath = join(transcriptsDir, agentId, `${agentId}.jsonl`);
      try {
        const content = await readFile(jsonlPath, "utf-8");
        const turns = content.split("\n").filter(Boolean).length;
        transcriptCache.set(agentId, { projectPath: projectName, turns });
      } catch {}
    }
  }
}

export async function getAllAgents(): Promise<AgentData[]> {
  await buildTranscriptCache();

  const headers = queryComposerHeaders();
  const agents: AgentData[] = [];

  for (const h of headers) {
    if (h.type !== "head") continue;

    const ws = extractWorkspaceName(h.workspaceIdentifier);
    const transcript = findTranscriptInfo(h.composerId);
    const lastMod = h.lastUpdatedAt || h.createdAt || 0;

    const title = h.name || h.subtitle || "(untitled)";

    // Skip empty/untitled drafts with no activity
    const hasActivity = (h.totalLinesAdded || 0) > 0 || (h.totalLinesRemoved || 0) > 0
      || (h.filesChangedCount || 0) > 0 || !!transcript;
    const isNamed = title !== "(untitled)" && title !== "New chat";
    if (!hasActivity && !isNamed) continue;

    agents.push({
      id: h.composerId,
      name: title,
      subtitle: h.subtitle || "",
      project: ws.project,
      projectPath: transcript?.projectPath || ws.projectPath,
      workspace: ws.workspacePath,
      lastModified: lastMod,
      createdAt: h.createdAt || lastMod,
      mode: h.unifiedMode || h.forceMode || "agent",
      linesAdded: h.totalLinesAdded || 0,
      linesRemoved: h.totalLinesRemoved || 0,
      filesChanged: h.filesChangedCount || 0,
      contextUsage: h.contextUsagePercent || 0,
      isArchived: h.isArchived || false,
      numSubComposers: h.numSubComposers || 0,
      status: getStatus(lastMod),
      hasTranscript: !!transcript,
      turns: transcript?.turns || 0,
    });
  }

  agents.sort((a, b) => b.lastModified - a.lastModified);
  return agents;
}

// --- Detail fetching (from transcripts) ---

const DETAIL_TRUNC = 140;
const HOME = process.env.HOME || "";

function compactPath(absPath: string, max = DETAIL_TRUNC): string {
  const p =
    HOME && absPath.startsWith(HOME) ? "~" + absPath.slice(HOME.length) : absPath;
  if (p.length <= max) return p;
  return "…" + p.slice(-(max - 1));
}

function truncateDetail(s: string, max = DETAIL_TRUNC): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
}

function extractTimestamp(rawText: string): string | undefined {
  const m = rawText.match(/<timestamp>\s*([^<]+)\s*<\/timestamp>/i);
  return m?.[1]?.trim() || undefined;
}

function toolCallDetail(
  name: string,
  input: Record<string, unknown>
): string | undefined {
  switch (name) {
    case "Read":
    case "Write":
    case "StrReplace":
    case "Delete": {
      const p = input.path;
      if (typeof p === "string" && p) return compactPath(p);
      break;
    }
    case "Shell": {
      const cmd = input.command;
      if (typeof cmd === "string" && cmd) return truncateDetail(cmd);
      break;
    }
    case "Grep": {
      const pat = input.pattern;
      if (typeof pat !== "string" || !pat) break;
      const parts: string[] = [truncateDetail(pat, 80)];
      if (typeof input.glob === "string" && input.glob) parts.push(`glob:${input.glob}`);
      else if (typeof input.path === "string" && input.path) parts.push(compactPath(input.path, 48));
      return parts.join(" · ");
    }
    case "Glob": {
      const g = input.glob_pattern;
      if (typeof g !== "string" || !g) break;
      if (typeof input.target_directory === "string" && input.target_directory)
        return `${g} · ${compactPath(input.target_directory, 64)}`;
      return g;
    }
    default:
      break;
  }
  return undefined;
}

function blocksToToolCalls(
  blocks: Array<{ type?: string; name?: string; input?: Record<string, unknown> }>
): ConversationToolCall[] {
  const out: ConversationToolCall[] = [];
  for (const b of blocks) {
    if (b.type !== "tool_use") continue;
    const name = b.name ?? "tool";
    const detail =
      b.input && typeof b.input === "object" && !Array.isArray(b.input)
        ? toolCallDetail(name, b.input as Record<string, unknown>)
        : undefined;
    out.push(detail !== undefined ? { name, detail } : { name });
  }
  return out;
}

function collectFileTouches(
  blocks: Array<{ type?: string; name?: string; input?: Record<string, unknown> }>
): FileTouch[] | undefined {
  const map = new Map<string, FileTouch["op"]>();
  for (const b of blocks) {
    if (b.type !== "tool_use") continue;
    const inp = b.input?.path;
    if (typeof inp !== "string" || !inp) continue;
    if (b.name === "Read") map.set(inp, "read");
    else if (b.name === "Write" || b.name === "StrReplace") map.set(inp, "write");
  }
  if (map.size === 0) return undefined;
  return [...map.entries()].map(([path, op]) => ({ path, op }));
}

/** Full raw transcript for server-side analysis (e.g. Prompt Coach). Chronological line order. */
export async function readAgentTranscript(agentId: string): Promise<string | null> {
  await buildTranscriptCache();
  const transcript = transcriptCache.get(agentId);
  if (!transcript) return null;

  const jsonlPath = join(
    PROJECTS_DIR,
    transcript.projectPath,
    "agent-transcripts",
    agentId,
    `${agentId}.jsonl`
  );

  try {
    return await readFile(jsonlPath, "utf-8");
  } catch {
    return null;
  }
}

/** Filesystem metadata for the agent JSONL transcript (cache invalidation). */
export async function getAgentTranscriptFileStat(agentId: string): Promise<{
  path: string;
  mtimeMs: number;
  size: number;
} | null> {
  await buildTranscriptCache();
  const transcript = transcriptCache.get(agentId);
  if (!transcript) return null;

  const jsonlPath = join(
    PROJECTS_DIR,
    transcript.projectPath,
    "agent-transcripts",
    agentId,
    `${agentId}.jsonl`
  );
  try {
    const s = await stat(jsonlPath);
    return { path: jsonlPath, mtimeMs: s.mtimeMs, size: s.size };
  } catch {
    return null;
  }
}

export async function getAgentDetail(
  agentId: string,
  options?: { offset?: number; limit?: number }
): Promise<{
  agent: AgentData;
  conversation: ConversationEntry[];
  totalEntries: number;
  hasMore: boolean;
} | null> {
  const agents = await getAllAgents();
  const agent = agents.find((a) => a.id === agentId);
  if (!agent) return null;

  const conversation: ConversationEntry[] = [];

  const transcript = transcriptCache.get(agentId);
  if (!transcript) return { agent, conversation, totalEntries: 0, hasMore: false };

  const jsonlPath = join(
    PROJECTS_DIR,
    transcript.projectPath,
    "agent-transcripts",
    agentId,
    `${agentId}.jsonl`
  );

  const offset = options?.offset ?? 0;
  const limit = options?.limit ?? 50;

  try {
    const content = await readFile(jsonlPath, "utf-8");
    const lines = content.split("\n").filter(Boolean);
    const totalLines = lines.length;

    // Reverse: most recent entries first
    const reversed = [...lines].reverse();
    const page = reversed.slice(offset, offset + limit);

    for (const line of page) {
      try {
        const entry = JSON.parse(line);
        const role = entry.role as string;
        let rawText = "";
        const blocks = entry.message?.content || [];

        for (const block of blocks) {
          if (block.type === "text" && typeof block.text === "string")
            rawText += block.text;
        }

        const toolCallsParsed = blocksToToolCalls(blocks);
        const toolCalls = toolCallsParsed.length > 0 ? toolCallsParsed : undefined;

        const cleanText = rawText
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 420);

        const timestamp = extractTimestamp(rawText);
        const filesTouched = blocks.length > 0 ? collectFileTouches(blocks) : undefined;

        if (cleanText || (toolCalls && toolCalls.length > 0)) {
          conversation.push({ role, content: cleanText, toolCalls, timestamp, filesTouched });
        }
      } catch {}
    }

    return { agent, conversation, totalEntries: totalLines, hasMore: offset + limit < totalLines };
  } catch {}

  return { agent, conversation, totalEntries: 0, hasMore: false };
}

export type { ConversationEntry, ConversationToolCall } from "@/types/conversation";
