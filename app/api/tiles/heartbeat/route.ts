import { heartbeat } from "@/lib/tileCoordinator";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { clientId?: string; tileId?: string }
    | null;

  if (!body?.clientId || !body.tileId) {
    return Response.json({ error: "clientId and tileId required" }, { status: 400 });
  }

  const lease = heartbeat(body.tileId, body.clientId);
  if (!lease) {
    return Response.json({ error: "lease not found" }, { status: 404 });
  }

  return Response.json({ ok: true, lease });
}
