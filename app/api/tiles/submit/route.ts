import { updateTile } from "@/lib/mosaicStore";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | {
        tileId?: string;
        tileX?: number;
        tileY?: number;
        tilesX?: number;
        tilesY?: number;
        imageDataUrl?: string;
      }
    | null;

  if (
    !body?.tileId ||
    body.tileX === undefined ||
    body.tileY === undefined ||
    body.tilesX === undefined ||
    body.tilesY === undefined ||
    !body.imageDataUrl
  ) {
    return Response.json({ error: "missing tile payload" }, { status: 400 });
  }

  updateTile({
    tileId: body.tileId,
    tileX: body.tileX,
    tileY: body.tileY,
    tilesX: body.tilesX,
    tilesY: body.tilesY,
    updatedAt: Date.now(),
    imageDataUrl: body.imageDataUrl,
  });

  return Response.json({ ok: true });
}
