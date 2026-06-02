const BACKEND = `${process.env.BACKEND_URL}/api`;

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const days = searchParams.get("days") || "30";
  const res = await fetch(`${BACKEND}/topics/distribution?days=${days}`, {
    headers: { Authorization: req.headers.get("authorization") || "" },
  });
  const data = await res.json();
  return Response.json(data, { status: res.status });
}