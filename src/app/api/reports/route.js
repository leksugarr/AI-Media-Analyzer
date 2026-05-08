// src/app/api/reports/route.js
export async function GET() {
  try {
    const res = await fetch("http://localhost:5000/api/reports");
    const data = await res.json();
    return Response.json(data, { status: res.status });
  } catch {
    return Response.json({ error: "Backend unreachable" }, { status: 502 });
  }
}