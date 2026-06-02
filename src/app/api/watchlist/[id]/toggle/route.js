const BACKEND = `${process.env.BACKEND_URL}/api`;

export async function PATCH(req, { params }) {
  const { id } = await params;
  const res = await fetch(`${BACKEND}/watchlist/${id}/toggle`, { method: "PATCH" });
  const data = await res.json();
  return Response.json(data, { status: res.status });
}