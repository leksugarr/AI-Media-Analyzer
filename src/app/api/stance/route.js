import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const res  = await fetch(`${process.env.BACKEND_URL}/api/stance/status");
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Backend unreachable" }, { status: 502 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const res  = await fetch(`${process.env.BACKEND_URL}/api/stance/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Backend unreachable" }, { status: 502 });
  }
}