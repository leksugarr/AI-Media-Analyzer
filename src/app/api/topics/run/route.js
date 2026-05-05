const BACKEND = "http://localhost:5000/api";

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const res = await fetch(`${BACKEND}/topics/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: req.headers.get("authorization") || "",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return Response.json(data, { status: res.status });
}