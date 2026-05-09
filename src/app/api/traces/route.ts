import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const res = await fetch("http://127.0.0.1:8080/sessions", {
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json({ sessions: [], total: 0 });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ sessions: [], total: 0 });
  }
}
