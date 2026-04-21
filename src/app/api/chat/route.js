
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000";

export async function POST(request) {
  const body = await request.json();
  const { messages } = body;

  if (!messages || !messages.length) {
    return Response.json({ error: "Messages required" }, { status: 400 });
  }

  try {
    const authHeader = request.headers.get("authorization");
    const res = await fetch(`${BACKEND_URL}/api/topic-analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify({ messages }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const err = await res.json();
      return Response.json({ error: err.error || "Chat failed" }, { status: res.status });
    }

    return Response.json(await res.json(), { status: 200 });
  } catch (err) {
    console.error("Backend unreachable:", err.message);
    return Response.json({ error: "Backend unreachable" }, { status: 503 });
  }
}