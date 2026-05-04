const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000";

export async function GET() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/analyze/status`);
    return Response.json(await res.json(), { status: res.status });
  } catch {
    return Response.json({ error: "Backend unreachable" }, { status: 503 });
  }
}