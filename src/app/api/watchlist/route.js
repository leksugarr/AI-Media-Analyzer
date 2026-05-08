const BACKEND = "http://localhost:5000/api";

export async function GET() {
  const res = await fetch(`${BACKEND}/watchlist`);
  const data = await res.json();
  return Response.json(data, { status: res.status });
}

export async function POST(req) {
  const body = await req.json();
  const res = await fetch(`${BACKEND}/watchlist`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return Response.json(data, { status: res.status });
}