import { assignTile, configureGrid, listLeases } from "@/lib/tileCoordinator";

export async function GET() {
  return Response.json({ leases: listLeases() });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | {
        clientId?: string;
        tilesX?: number;
        tilesY?: number;
      }
    | null;

  if (!body?.clientId) {
    return Response.json({ error: "clientId required" }, { status: 400 });
  }

  if (body.tilesX && body.tilesY) {
    configureGrid(body.tilesX, body.tilesY);
  }

  const lease = assignTile(body.clientId);
  return Response.json({ lease });
}
