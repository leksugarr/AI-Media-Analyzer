const BACKEND = "http://localhost:5000/api";

export async function POST(req, { params }) {
  const { id } = await params;
  const res = await fetch(`${BACKEND}/suggestions/reject/${id}`, { method: "POST" });
  const data = await res.json();
  return Response.json(data, { status: res.status });
}