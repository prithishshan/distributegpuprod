import { getTiles } from "@/lib/mosaicStore";

export async function GET() {
  return Response.json({ tiles: getTiles() });
}
