const BACKEND = "http://localhost:5000/api";

export async function DELETE(req, { params }) {
  const { id } = await params;
  const res = await fetch(`${BACKEND}/watchlist/${id}`, { method: "DELETE" });
  const data = await res.json();
  return Response.json(data, { status: res.status });
}