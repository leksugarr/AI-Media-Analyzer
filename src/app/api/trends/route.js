// src/app/api/trends/route.js
import { NextResponse } from "next/server";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const params = new URLSearchParams();
  if (searchParams.get("keyword")) params.set("keyword", searchParams.get("keyword"));
  if (searchParams.get("days"))    params.set("days",    searchParams.get("days"));

  try {
    const res  = await fetch(`${process.env.BACKEND_URL}/api/trends?${params}`);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json({ error: "Backend unreachable" }, { status: 502 });
  }
}