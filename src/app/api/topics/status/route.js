const BACKEND = "http://localhost:5000/api";

export async function GET(req) {
  const res = await fetch(`${BACKEND}/topics/status`, {
    headers: { Authorization: req.headers.get("authorization") || "" },
  });
  const data = await res.json();
  return Response.json(data, { status: res.status });
}