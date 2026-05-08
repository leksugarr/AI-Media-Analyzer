import { NextResponse } from "next/server";

const BACKEND = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const keyword = searchParams.get("keyword");
  if (!keyword) {
    return NextResponse.json({ error: "keyword required" }, { status: 400 });
  }
  try {
    const r = await fetch(
      `${BACKEND}/api/stance/by-keyword?keyword=${encodeURIComponent(keyword)}`
    );
    const data = await r.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: "Backend unreachable" }, { status: 502 });
  }
}