import { resolve } from "path";
import { NextResponse, type NextRequest } from "next/server";
import { sanitizeWorkspaceQueryParam, tracesDirForListing } from "@/lib/tracePaths";
import { sessionsFromDisk } from "@/lib/tracesDiskListing";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const workspaceRaw = req.nextUrl.searchParams.get("workspace");
  const validatedWs = sanitizeWorkspaceQueryParam(workspaceRaw);

  if (workspaceRaw?.trim().length && !validatedWs) {
    return NextResponse.json(
      { error: "Invalid or disallowed workspace path", sessions: [], total: 0 },
      { status: 400 }
    );
  }

  try {
    const tracesDir = tracesDirForListing(validatedWs);
    const inferredWs = validatedWs ?? resolve(process.cwd());
    const sessions = await sessionsFromDisk(tracesDir, {
      inferredWorkspaceFallback: inferredWs,
    });
    return NextResponse.json({ sessions, total: sessions.length });
  } catch {
    return NextResponse.json({ sessions: [], total: 0 });
  }
}
