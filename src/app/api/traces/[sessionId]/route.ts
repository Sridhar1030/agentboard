import { readFile, readdir } from "fs/promises";
import { join } from "path";
import { NextResponse, type NextRequest } from "next/server";
import { normalizeTraceEnvelope } from "@/lib/traceDagNormalize";
import { sanitizeWorkspaceQueryParam, tracesDirForListing } from "@/lib/tracePaths";

export const dynamic = "force-dynamic";

async function loadTraceEnvelopeFromTracesDir(
  tracesDir: string,
  sessionId: string
): Promise<Record<string, unknown> | null> {
  let dateDirs: string[];
  try {
    dateDirs = await readdir(tracesDir);
  } catch {
    return null;
  }
  for (const dateDir of dateDirs) {
    if (dateDir.startsWith(".")) continue;
    const datePath = join(tracesDir, dateDir);
    let sessionDirs: string[];
    try {
      sessionDirs = await readdir(datePath);
    } catch {
      continue;
    }
    if (!sessionDirs.includes(sessionId)) continue;
    const sessionPath = join(datePath, sessionId);
    let files: string[];
    try {
      files = await readdir(sessionPath);
    } catch {
      continue;
    }
    const jsonFile = files.find((f) => f.endsWith(".json"));
    if (!jsonFile) continue;
    try {
      const raw = await readFile(join(sessionPath, jsonFile), "utf-8");
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Query workspace first (validated), then the AgentBoard cwd — so deep links still resolve when
 * a session folder id lives under the dashboard project.
 */
function tracesSearchDirectories(validatedWs: string | null): string[] {
  const dirs: string[] = [];
  if (validatedWs) dirs.push(tracesDirForListing(validatedWs));
  const cwdRoot = tracesDirForListing(null);
  if (!dirs.includes(cwdRoot)) dirs.push(cwdRoot);
  return dirs;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const workspaceRaw = req.nextUrl.searchParams.get("workspace");
  const validatedWs = sanitizeWorkspaceQueryParam(workspaceRaw);

  if (workspaceRaw?.trim().length && !validatedWs) {
    return NextResponse.json({ error: "Invalid or disallowed workspace path" }, { status: 400 });
  }

  try {
    const searchDirs = tracesSearchDirectories(validatedWs);

    for (const tracesDir of searchDirs) {
      const parsed = await loadTraceEnvelopeFromTracesDir(tracesDir, sessionId);
      if (parsed) {
        const events = normalizeTraceEnvelope(parsed, sessionId);
        return NextResponse.json({ ...parsed, events });
      }
    }
    return NextResponse.json({ error: "Trace not found" }, { status: 404 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
