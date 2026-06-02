const BACKEND = `${process.env.BACKEND_URL}/api`;

export async function POST(req, { params }) {
  const { id } = await params;
  const res = await fetch(`${BACKEND}/suggestions/approve/${id}`, { method: "POST" });
  const data = await res.json();
  return Response.json(data, { status: res.status });
}