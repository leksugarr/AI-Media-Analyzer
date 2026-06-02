const BACKEND = `${process.env.BACKEND_URL}/api`;

export async function POST(req) {
  const body = await req.json();
  const res = await fetch(`${BACKEND}/semantic-search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return Response.json(data, { status: res.status });
}