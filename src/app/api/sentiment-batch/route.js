const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000";

export async function POST() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/analyze/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 50 }),
    });
    return Response.json(await res.json(), { status: res.status });
  } catch {
    return Response.json({ error: "Backend unreachable" }, { status: 503 });
  }
}