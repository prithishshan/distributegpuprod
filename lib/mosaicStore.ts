export type TileSnapshot = {
  tileId: string;
  tileX: number;
  tileY: number;
  tilesX: number;
  tilesY: number;
  updatedAt: number;
  imageDataUrl: string;
};

const tiles = new Map<string, TileSnapshot>();

export function updateTile(snapshot: TileSnapshot) {
  tiles.set(snapshot.tileId, snapshot);
}

export function getTiles() {
  return Array.from(tiles.values());
}

export function clearTiles() {
  tiles.clear();
}
