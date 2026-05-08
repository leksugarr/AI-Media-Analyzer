const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000";

export async function POST(request) {
  const body = await request.json();
  const { messages, conversationId } = body;

  if (!messages || !messages.length)
    return Response.json({ error: "Messages required" }, { status: 400 });

  try {
    const authHeader = request.headers.get("authorization");
    const res = await fetch(`${BACKEND_URL}/api/conversation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify({ messages, conversationId }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const err = await res.json();
      return Response.json({ error: err.error || "Chat failed" }, { status: res.status });
    }

    return Response.json(await res.json(), { status: 200 });
  } catch (err) {
    return Response.json({ error: "Backend unreachable" }, { status: 503 });
  }
}

export async function GET(request) {
  try {
    const authHeader = request.headers.get("authorization");
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    const url = id
      ? `${BACKEND_URL}/api/conversation/${id}`
      : `${BACKEND_URL}/api/conversations`;

    const res = await fetch(url, {
      headers: { ...(authHeader ? { Authorization: authHeader } : {}) },
    });

    return Response.json(await res.json(), { status: res.status });
  } catch (err) {
    return Response.json({ error: "Backend unreachable" }, { status: 503 });
  }
}