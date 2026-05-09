import type { AgentData } from "@/lib/agents";
import { getAllAgents } from "@/lib/agents";
import { existsSync } from "fs";
import { readFile, readdir } from "fs/promises";
import { join } from "path";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const TRACES_DIR = join(process.cwd(), ".cursor", "traces");

function projectMatches(agent: AgentData, workspace: string): boolean {
  const w = workspace.trim().toLowerCase();
  if (!w) return true;
  const slugHyphen = w.replace(/\s+/g, "-");
  const slugUnder = w.replace(/\s+/g, "_");
  return (
    agent.project.toLowerCase() === w ||
    agent.projectPath.toLowerCase().includes(slugHyphen) ||
    agent.projectPath.toLowerCase().includes(slugUnder) ||
    agent.workspace.toLowerCase().includes(slugHyphen) ||
    agent.workspace.toLowerCase().includes(w)
  );
}

function traceBelongsToWorkspace(trace: Record<string, unknown>, workspaceAgents: AgentData[]): boolean {
  const roots = [...new Set(workspaceAgents.map((a) => a.workspace).filter(Boolean))];
  if (roots.length === 0) return false;

  const session = trace.session as Record<string, unknown> | undefined;
  const events = (trace.events || []) as Array<Record<string, unknown>>;
  const paths: string[] = [...((session?.repo_snapshot as string[]) || [])];
  for (const ev of events) {
    paths.push(...((ev.files_read as string[]) || []));
    paths.push(...((ev.files_modified as string[]) || []));
    paths.push(...((ev.files_created as string[]) || []));
  }

  const relPaths = [...new Set(paths)].filter(
    (p) => p && typeof p === "string" && !p.startsWith("/") && !p.includes("Library/Application")
  );

  for (const rel of relPaths.slice(0, 24)) {
    for (const root of roots) {
      try {
        if (existsSync(join(root, rel))) return true;
      } catch {
        /* skip */
      }
    }
  }
  return false;
}

interface FileNode {
  id: string;
  name: string;
  touches: number;
  reads: number;
  writes: number;
  sessions: number;
}

interface FileEdge {
  source: string;
  target: string;
  weight: number;
}

interface SessionPattern {
  file: string;
  sessionsToday: number;
  sessionsWeek: number;
  totalSessions: number;
  avgLinesChanged: number;
}

function directoryGroupKey(filePath: string): string {
  const parts = filePath.split("/").filter(Boolean);
  if (parts.length <= 1) return "(root)";
  return parts[0];
}

interface DirectoryGroup {
  dir: string;
  totalTouches: number;
  fileCount: number;
  files: FileNode[];
}

interface CoModificationPair {
  a: string;
  b: string;
  aName: string;
  bName: string;
  weight: number;
}

interface FileActivityTimeline {
  sessions: { id: string; label: string; started_at: string }[];
  rows: {
    fileId: string;
    fileName: string;
    reads: number;
    writes: number;
    touched: boolean[];
  }[];
}

export async function GET(req: NextRequest) {
  try {
    const workspaceParam = req.nextUrl.searchParams.get("workspace")?.trim() || "";
    const sessionParam = req.nextUrl.searchParams.get("session")?.trim() || "";

    const allAgents = await getAllAgents();
    const workspaceAgents = workspaceParam
      ? allAgents.filter((a) => projectMatches(a, workspaceParam))
      : allAgents;

    const agentsForStats = workspaceParam ? workspaceAgents : allAgents;

    // Build file co-modification graph from traces
    const fileSessionMap = new Map<string, Set<string>>();
    const fileReads = new Map<string, number>();
    const fileWrites = new Map<string, number>();
    const sessionFiles = new Map<string, string[]>();
    const traceSessionSummaries: { session_id: string; task: string; started_at: string }[] = [];

    // Parse trace files (optionally scoped by session and/or workspace)
    try {
      const dateDirs = await readdir(TRACES_DIR);
      for (const dateDir of dateDirs) {
        const datePath = join(TRACES_DIR, dateDir);
        let sessionDirs: string[];
        try {
          sessionDirs = await readdir(datePath);
        } catch { continue; }

        for (const sessionDir of sessionDirs) {
          if (sessionParam && sessionDir !== sessionParam) continue;

          const sessionPath = join(datePath, sessionDir);
          let files: string[];
          try {
            files = await readdir(sessionPath);
          } catch { continue; }

          const jsonFile = files.find((f) => f.endsWith(".json"));
          if (!jsonFile) continue;

          try {
            const content = await readFile(join(sessionPath, jsonFile), "utf-8");
            const trace = JSON.parse(content) as Record<string, unknown>;
            if (workspaceParam && !sessionParam && !traceBelongsToWorkspace(trace, workspaceAgents)) {
              continue;
            }
            const sessionId =
              (trace.session as { session_id?: string } | undefined)?.session_id || sessionDir;
            const allFilesInSession: string[] = [];

            for (const ev of (trace.events as Record<string, unknown>[] | undefined) || []) {
              const reads = (ev.files_read as string[]) || [];
              const modified = (ev.files_modified as string[]) || [];
              const created = (ev.files_created as string[]) || [];
              for (const f of reads) {
                fileReads.set(f, (fileReads.get(f) || 0) + 1);
                if (!fileSessionMap.has(f)) fileSessionMap.set(f, new Set());
                fileSessionMap.get(f)!.add(sessionId);
                allFilesInSession.push(f);
              }
              for (const f of [...modified, ...created]) {
                fileWrites.set(f, (fileWrites.get(f) || 0) + 1);
                if (!fileSessionMap.has(f)) fileSessionMap.set(f, new Set());
                fileSessionMap.get(f)!.add(sessionId);
                allFilesInSession.push(f);
              }
            }

            // Also add repo_snapshot files
            const sess = trace.session as { repo_snapshot?: string[] } | undefined;
            for (const f of sess?.repo_snapshot || []) {
              if (!fileSessionMap.has(f)) fileSessionMap.set(f, new Set());
              fileSessionMap.get(f)!.add(sessionId);
              allFilesInSession.push(f);
            }

            sessionFiles.set(sessionId, [...new Set(allFilesInSession)]);
            traceSessionSummaries.push({
              session_id: String(sessionId),
              task: String((trace.session as { task?: string } | undefined)?.task || ""),
              started_at: String((trace.session as { started_at?: string } | undefined)?.started_at || ""),
            });
          } catch {}
        }
      }
    } catch {}

    // Also extract file info from agent metadata (filesChanged field gives us counts but not names)
    // For the graph, focus on trace data which has actual file paths

    // Build nodes
    const nodes: FileNode[] = [];
    for (const [filePath, sessions] of fileSessionMap.entries()) {
      const name = filePath.split("/").pop() || filePath;
      nodes.push({
        id: filePath,
        name,
        touches: (fileReads.get(filePath) || 0) + (fileWrites.get(filePath) || 0),
        reads: fileReads.get(filePath) || 0,
        writes: fileWrites.get(filePath) || 0,
        sessions: sessions.size,
      });
    }

    // Build edges (files modified in the same session)
    const edgeMap = new Map<string, number>();
    for (const [, files] of sessionFiles.entries()) {
      const unique = [...new Set(files)];
      for (let i = 0; i < unique.length; i++) {
        for (let j = i + 1; j < unique.length; j++) {
          const key = [unique[i], unique[j]].sort().join("|||");
          edgeMap.set(key, (edgeMap.get(key) || 0) + 1);
        }
      }
    }

    const edges: FileEdge[] = [];
    for (const [key, weight] of edgeMap.entries()) {
      if (weight < 1) continue;
      const [source, target] = key.split("|||");
      edges.push({ source, target, weight });
    }

    // Cross-session patterns: most touched files from agent metadata
    const filePatterns: SessionPattern[] = nodes
      .sort((a, b) => b.touches - a.touches)
      .slice(0, 20)
      .map((n) => ({
        file: n.id,
        sessionsToday: 0,
        sessionsWeek: 0,
        totalSessions: n.sessions,
        avgLinesChanged: 0,
      }));

    // Session timeline data (for sparkline)
    const sessionTimeline = agentsForStats.slice(0, 100).map((a) => ({
      date: a.lastModified,
      lines: a.linesAdded + a.linesRemoved,
      files: a.filesChanged,
      mode: a.mode,
      project: a.project,
    }));

    // Top projects by activity
    const projectMap = new Map<string, { sessions: number; lines: number; files: number }>();
    for (const a of agentsForStats) {
      const p = projectMap.get(a.project) || { sessions: 0, lines: 0, files: 0 };
      p.sessions++;
      p.lines += a.linesAdded + a.linesRemoved;
      p.files += a.filesChanged;
      projectMap.set(a.project, p);
    }

    const topProjects = [...projectMap.entries()]
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.lines - a.lines)
      .slice(0, 10);

    // Hottest sessions (most impactful)
    const hottestSessions = agentsForStats
      .slice(0, 200)
      .sort((a, b) => (b.linesAdded + b.linesRemoved + b.filesChanged * 10) - (a.linesAdded + a.linesRemoved + a.filesChanged * 10))
      .slice(0, 8)
      .map((a) => ({
        id: a.id,
        name: a.name,
        project: a.project,
        linesAdded: a.linesAdded,
        linesRemoved: a.linesRemoved,
        filesChanged: a.filesChanged,
        contextUsage: a.contextUsage,
        mode: a.mode,
      }));

    const seenTrace = new Set<string>();
    const traceSessions = traceSessionSummaries.filter((t) => {
      if (seenTrace.has(t.session_id)) return false;
      seenTrace.add(t.session_id);
      return true;
    });
    traceSessions.sort((a, b) => {
      const ta = new Date(a.started_at || 0).getTime();
      const tb = new Date(b.started_at || 0).getTime();
      return tb - ta;
    });

    const nodesByTouches = [...nodes].sort((a, b) => b.touches - a.touches);

    const dirAcc = new Map<string, FileNode[]>();
    for (const n of nodesByTouches) {
      const k = directoryGroupKey(n.id);
      if (!dirAcc.has(k)) dirAcc.set(k, []);
      dirAcc.get(k)!.push(n);
    }
    const MAX_FILES_PER_DIR = 12;
    const byDirectory: DirectoryGroup[] = [...dirAcc.entries()]
      .map(([dir, files]) => {
        const sorted = [...files].sort((a, b) => b.touches - a.touches);
        return {
          dir,
          totalTouches: sorted.reduce((s, f) => s + f.touches, 0),
          fileCount: sorted.length,
          files: sorted.slice(0, MAX_FILES_PER_DIR),
        };
      })
      .sort((a, b) => b.totalTouches - a.totalTouches)
      .slice(0, 14);

    const topPairs: CoModificationPair[] = [...edgeMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 18)
      .map(([key, weight]) => {
        const [a, b] = key.split("|||");
        return {
          a,
          b,
          aName: a.split("/").pop() || a,
          bName: b.split("/").pop() || b,
          weight,
        };
      });
    const maxPairWeight = topPairs.length ? Math.max(...topPairs.map((p) => p.weight)) : 1;

    const TIMELINE_SESSIONS = 18;
    const TIMELINE_FILES = 22;
    const chrono = [...traceSessions].sort(
      (a, b) => new Date(a.started_at || 0).getTime() - new Date(b.started_at || 0).getTime()
    );
    const timelineSlice = chrono.slice(-TIMELINE_SESSIONS);
    const timelineSessionIds = timelineSlice.map((t) => t.session_id);
    const timelineRowCandidates = nodesByTouches.filter((n) =>
      timelineSessionIds.some((sid) => (sessionFiles.get(sid) || []).includes(n.id))
    );
    const fileActivityTimeline: FileActivityTimeline = {
      sessions: timelineSlice.map((t) => {
        const raw = t.task || t.session_id;
        const label = raw.length > 44 ? `${raw.slice(0, 42)}…` : raw;
        return { id: t.session_id, label, started_at: t.started_at };
      }),
      rows: timelineRowCandidates.slice(0, TIMELINE_FILES).map((n) => ({
        fileId: n.id,
        fileName: n.name,
        reads: n.reads,
        writes: n.writes,
        touched: timelineSessionIds.map((sid) => {
          const files = sessionFiles.get(sid) || [];
          return files.includes(n.id);
        }),
      })),
    };

    let totals = {
      totalSessions: agentsForStats.length,
      totalLines: agentsForStats.reduce((s, a) => s + a.linesAdded + a.linesRemoved, 0),
      totalFiles: agentsForStats.reduce((s, a) => s + a.filesChanged, 0),
      avgContext:
        agentsForStats.filter((a) => a.contextUsage > 0).reduce((s, a) => s + a.contextUsage, 0) /
        (agentsForStats.filter((a) => a.contextUsage > 0).length || 1),
    };

    if (sessionParam) {
      totals = {
        totalSessions: 1,
        totalLines: 0,
        totalFiles: nodes.length,
        avgContext: 0,
      };
    }

    return NextResponse.json({
      graph: { nodes: nodesByTouches.slice(0, 40), edges: edges.sort((a, b) => b.weight - a.weight).slice(0, 80) },
      fileIntelligence: {
        byDirectory,
        topPairs,
        maxPairWeight,
        fileActivityTimeline,
        traceSessionCount: sessionFiles.size,
      },
      filePatterns,
      sessionTimeline,
      topProjects,
      hottestSessions,
      traceSessions,
      filter: { workspace: workspaceParam || null, session: sessionParam || null },
      totals,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
