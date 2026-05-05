const BACKEND = "http://localhost:5000/api";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "pending";
  const res = await fetch(`${BACKEND}/suggestions?status=${status}`);
  const data = await res.json();
  return Response.json(data, { status: res.status });
}