import { getAllAgents } from "@/lib/agents";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10) || 0);
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") || "50", 10) || 50));

    const allAgents = await getAllAgents();
    const page = allAgents.slice(offset, offset + limit);

    return NextResponse.json({
      agents: page,
      total: allAgents.length,
      offset,
      limit,
      hasMore: offset + limit < allAgents.length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
