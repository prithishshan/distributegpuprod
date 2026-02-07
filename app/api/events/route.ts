export async function GET() {
  return new Response("SSE not implemented yet", {
    status: 501,
    headers: {
      "Content-Type": "text/plain",
    },
  });
}
