const BACKEND = `${process.env.BACKEND_URL}/api`;

export async function POST() {
  const res = await fetch(`${BACKEND}/suggestions/run`, { method: "POST" });
  const data = await res.json();
  return Response.json(data, { status: res.status });
}