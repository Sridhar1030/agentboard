import { getAllAgents } from "@/lib/agents";
import { readFile, readdir } from "fs/promises";
import { join } from "path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const TRACES_DIR = join(process.cwd(), ".cursor", "traces");

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

export async function GET() {
  try {
    const agents = await getAllAgents();

    // Build file co-modification graph from traces
    const fileSessionMap = new Map<string, Set<string>>();
    const fileReads = new Map<string, number>();
    const fileWrites = new Map<string, number>();
    const sessionFiles = new Map<string, string[]>();

    // Parse all trace files
    try {
      const dateDirs = await readdir(TRACES_DIR);
      for (const dateDir of dateDirs) {
        const datePath = join(TRACES_DIR, dateDir);
        let sessionDirs: string[];
        try {
          sessionDirs = await readdir(datePath);
        } catch { continue; }

        for (const sessionDir of sessionDirs) {
          const sessionPath = join(datePath, sessionDir);
          let files: string[];
          try {
            files = await readdir(sessionPath);
          } catch { continue; }

          const jsonFile = files.find((f) => f.endsWith(".json"));
          if (!jsonFile) continue;

          try {
            const content = await readFile(join(sessionPath, jsonFile), "utf-8");
            const trace = JSON.parse(content);
            const sessionId = trace.session?.session_id || sessionDir;
            const allFilesInSession: string[] = [];

            for (const ev of trace.events || []) {
              for (const f of ev.files_read || []) {
                fileReads.set(f, (fileReads.get(f) || 0) + 1);
                if (!fileSessionMap.has(f)) fileSessionMap.set(f, new Set());
                fileSessionMap.get(f)!.add(sessionId);
                allFilesInSession.push(f);
              }
              for (const f of [...(ev.files_modified || []), ...(ev.files_created || [])]) {
                fileWrites.set(f, (fileWrites.get(f) || 0) + 1);
                if (!fileSessionMap.has(f)) fileSessionMap.set(f, new Set());
                fileSessionMap.get(f)!.add(sessionId);
                allFilesInSession.push(f);
              }
            }

            // Also add repo_snapshot files
            for (const f of trace.session?.repo_snapshot || []) {
              if (!fileSessionMap.has(f)) fileSessionMap.set(f, new Set());
              fileSessionMap.get(f)!.add(sessionId);
              allFilesInSession.push(f);
            }

            sessionFiles.set(sessionId, [...new Set(allFilesInSession)]);
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
    const now = Date.now();
    const ONE_DAY = 24 * 60 * 60 * 1000;
    const ONE_WEEK = 7 * ONE_DAY;

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
    const sessionTimeline = agents.slice(0, 100).map((a) => ({
      date: a.lastModified,
      lines: a.linesAdded + a.linesRemoved,
      files: a.filesChanged,
      mode: a.mode,
      project: a.project,
    }));

    // Top projects by activity
    const projectMap = new Map<string, { sessions: number; lines: number; files: number }>();
    for (const a of agents) {
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
    const hottestSessions = agents
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

    return NextResponse.json({
      graph: { nodes: nodes.sort((a, b) => b.touches - a.touches).slice(0, 40), edges: edges.slice(0, 80) },
      filePatterns,
      sessionTimeline,
      topProjects,
      hottestSessions,
      totals: {
        totalSessions: agents.length,
        totalLines: agents.reduce((s, a) => s + a.linesAdded + a.linesRemoved, 0),
        totalFiles: agents.reduce((s, a) => s + a.filesChanged, 0),
        avgContext: agents.filter((a) => a.contextUsage > 0).reduce((s, a) => s + a.contextUsage, 0) / (agents.filter((a) => a.contextUsage > 0).length || 1),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
