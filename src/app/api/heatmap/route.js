const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000";

export async function GET() {
  const res = await fetch(`${BACKEND}/heatmap`);
  const data = await res.json();
  return Response.json(data, { status: res.status });
}