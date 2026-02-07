"use client";

import { useMosaicStream } from "@/app/hooks/useMosaicStream";

export default function MosaicWall() {
  const { tiles, stats } = useMosaicStream();
  const tilesX = stats.tilesX || 1;
  const tilesY = stats.tilesY || 1;

  return (
    <main className="min-h-screen bg-black px-6 py-8 text-white">
      <header className="mb-6 flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">
          Live Mosaic
        </p>
        <h1 className="text-3xl font-semibold">Distributed Render Wall</h1>
        <p className="text-sm text-zinc-400">
          Active tiles: {tiles.length} · Clients: {stats.clientCount}
        </p>
      </header>

      <div
        className="relative mx-auto h-[720px] w-[1280px] overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${tilesX}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${tilesY}, minmax(0, 1fr))`,
        }}
      >
        {tiles.map((tile) => (
          <img
            key={tile.tileId}
            src={tile.imageDataUrl}
            alt={`Tile ${tile.tileId}`}
            className="h-full w-full object-cover"
            style={{
              gridColumn: tile.tileX + 1,
              gridRow: tile.tileY + 1,
            }}
          />
        ))}
      </div>
    </main>
  );
}
