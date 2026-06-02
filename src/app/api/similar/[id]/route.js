const BACKEND = `${process.env.BACKEND_URL}/api`;

export async function GET(req, { params }) {
  const { id } = await params;
  const res = await fetch(`${BACKEND}/similar/${id}`);
  const data = await res.json();
  return Response.json(data, { status: res.status });
}