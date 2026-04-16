// src/app/api/auth/login/route.js
// This Next.js API route proxies login to your Express backend.
// If you don't have a real backend yet, it falls back to mock auth.

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000";

export async function POST(request) {
  const body = await request.json();
  const { email, password } = body;

  // --- Try real backend first ---
  try {
    const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(10000),
    });

    const data = await res.json();

    if (res.ok) {
      return Response.json(
        { success: true, message: "Login successful", user: { email }, token: data.token },
        { status: 200 }
      );
    } else {
      return Response.json(
        { success: false, message: data.message || "Invalid credentials" },
        { status: 401 }
      );
    }
  } catch {
    // Backend unreachable — use mock auth so UI still works during development
  }

  // --- Mock auth fallback (remove in production) ---
  if (!email || !password) {
    return Response.json(
      { success: false, message: "Email and password required" },
      { status: 400 }
    );
  }

  if (password.length < 6) {
    return Response.json(
      { success: false, message: "Invalid credentials" },
      { status: 401 }
    );
  }

  return Response.json(
    { success: true, message: "Login successful (mock)", user: { email }, token:null },
    { status: 200 }
  );
}