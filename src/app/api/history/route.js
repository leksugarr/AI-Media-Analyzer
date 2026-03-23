const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000";

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
   console.log("📋 History auth header:", authHeader); 
  try {
    const res = await fetch(`${BACKEND_URL}/api/history`, {
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    return Response.json(data, { status: res.status });
  } catch {
    return Response.json({ error: "Failed to fetch history" }, { status: 500 });
  }
}