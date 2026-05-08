const BACKEND = "http://localhost:5000/api";

export async function GET() {
  const res = await fetch(`${BACKEND}/heatmap`);
  const data = await res.json();
  return Response.json(data, { status: res.status });
}