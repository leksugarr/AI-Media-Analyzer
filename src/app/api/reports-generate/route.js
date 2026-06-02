export async function POST() {
  try {
    const res = await fetch(`${process.env.BACKEND_URL}/api/reports/generate`, { method: "POST" });
    const data = await res.json();
    return Response.json(data, { status: res.status });
  } catch {
    return Response.json({ error: "Backend unreachable" }, { status: 502 });
  }
}