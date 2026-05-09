import { readFile } from "fs/promises";
import { join } from "path";
import { NextRequest, NextResponse } from "next/server";
import { readdir } from "fs/promises";

export const dynamic = "force-dynamic";

const TRACES_DIR = join(process.cwd(), ".cursor", "traces");

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  try {
    const dateDirs = await readdir(TRACES_DIR);
    for (const dateDir of dateDirs) {
      const datePath = join(TRACES_DIR, dateDir);
      let sessionDirs: string[];
      try {
        sessionDirs = await readdir(datePath).then((entries) => entries);
      } catch {
        continue;
      }
      if (sessionDirs.includes(sessionId)) {
        const sessionPath = join(datePath, sessionId);
        const files = await readdir(sessionPath);
        const jsonFile = files.find((f) => f.endsWith(".json"));
        if (!jsonFile) continue;
        const content = await readFile(join(sessionPath, jsonFile), "utf-8");
        return NextResponse.json(JSON.parse(content));
      }
    }
    return NextResponse.json({ error: "Trace not found" }, { status: 404 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
