import { mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";

import { getAllAgents, getAgentTranscriptFileStat, readAgentTranscript } from "@/lib/agents";
import {
  analyzeTranscriptHeuristic,
  buildSdkCoachContext,
  enrichWithSdkCoach,
  type CoachApiResponse,
} from "@/lib/promptCoach";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const CACHE_DIR = join(process.cwd(), ".cursor", "coach-cache");

interface CoachDiskCache {
  sourceMtimeMs: number;
  sourceSizeBytes: number;
  body: CoachApiResponse;
}

async function readDiskCache(agentId: string): Promise<CoachDiskCache | null> {
  const path = join(CACHE_DIR, `${agentId}.json`);
  try {
    const raw = await readFile(path, "utf-8");
    return JSON.parse(raw) as CoachDiskCache;
  } catch {
    return null;
  }
}

async function writeDiskCache(
  agentId: string,
  sourceMtimeMs: number,
  sourceSizeBytes: number,
  body: CoachApiResponse
): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });
  const path = join(CACHE_DIR, `${agentId}.json`);
  const payload: CoachDiskCache = { sourceMtimeMs, sourceSizeBytes, body };
  await writeFile(path, JSON.stringify(payload), "utf-8");
}

export async function GET(request: Request, { params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await params;
  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "true";

  const agents = await getAllAgents();
  const agent = agents.find((a) => a.id === agentId);
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const raw = await readAgentTranscript(agentId);
  if (!raw || !raw.trim()) {
    return NextResponse.json({
      agentId,
      error: "No transcript available for this agent.",
      sdkCoachAttempted: false,
      sdkCoachSucceeded: false,
    });
  }

  const transcriptStat = await getAgentTranscriptFileStat(agentId);

  if (!force && transcriptStat) {
    const cached = await readDiskCache(agentId);
    if (
      cached &&
      cached.sourceMtimeMs === transcriptStat.mtimeMs &&
      cached.sourceSizeBytes === transcriptStat.size &&
      cached.body.agentId === agentId
    ) {
      return NextResponse.json(cached.body);
    }
  }

  let analysis = analyzeTranscriptHeuristic(raw);
  const apiKey = process.env.CURSOR_API_KEY;

  let sdkCoachAttempted = false;
  let sdkCoachSucceeded = false;

  const sdkContext = buildSdkCoachContext(raw);
  if (apiKey && sdkContext.totalUserTurns > 0) {
    sdkCoachAttempted = true;
    analysis = await enrichWithSdkCoach(analysis, sdkContext, process.cwd(), apiKey);
    sdkCoachSucceeded = !analysis.usedHeuristicNarrative;
  }

  const body: CoachApiResponse = {
    ...analysis,
    agentId,
    sdkCoachAttempted,
    sdkCoachSucceeded,
  };

  if (transcriptStat) {
    try {
      await writeDiskCache(agentId, transcriptStat.mtimeMs, transcriptStat.size, body);
    } catch {
      // Cache is best-effort; response is still valid without disk write.
    }
  }

  return NextResponse.json(body);
}
