// src/app/api/summarize/route.js

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000";


export async function POST(request) {
  const body = await request.json();
  const { text } = body;

  if (!text || text.trim().length < 50) {
    return Response.json(
      { error: "Please provide at least 50 characters of text" },
      { status: 400 }
    );
  }

  // --- Try Express backend first ---
 // --- Try Express backend first ---
try {
  const authHeader = request.headers.get("authorization");
  console.log("📤 Auth header dikirim ke backend:", authHeader);
  const res = await fetch(`${BACKEND_URL}/api/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {

    return Response.json({error: err.error || "Analysis failed"}, { status: res.status });
  }return Response.json(await res.json(), { status: 200 });
} catch(err) {
  console.error("Backend unreachable:", err.message);
  return Response.json({ error: "Backend unreachable" }, { status: 503 });
  }
}
 