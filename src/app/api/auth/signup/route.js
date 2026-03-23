// src/app/api/auth/signup/route.js

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000";

export async function POST(request) {
  const body = await request.json();
  const { email, password } = body;

  if (!email || !password) {
    return Response.json(
      { success: false, message: "Email and password required" },
      { status: 400 }
    );
  }

  if (password.length < 6) {
    return Response.json(
      { success: false, message: "Password must be at least 6 characters" },
      { status: 400 }
    );
  }

  // --- Try real backend first ---
  try {
    const res = await fetch(`${BACKEND_URL}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(3000),
    });

    const data = await res.json();

    if (res.ok) {
      return Response.json(
        { success: true, message: "Account created!", user: { email } },
        { status: 201 }
      );
    } else {
      return Response.json(
        { success: false, message: data.message || "Signup failed" },
        { status: 400 }
      );
    }
  } catch {
    // Backend unreachable — mock success
  }

  // --- Mock fallback ---
  return Response.json(
    { success: true, message: "Account created! (mock)", user: { email } },
    { status: 201 }
  );
}