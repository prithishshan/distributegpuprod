"use client";

import type { TileLease } from "@/lib/tileCoordinator";

type TileStatusPanelProps = {
  lease: TileLease | null;
  statusText: string;
  fps?: number;
};

export default function TileStatusPanel({
  lease,
  statusText,
  fps,
}: TileStatusPanelProps) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 text-sm text-zinc-200">
      <h2 className="text-base font-semibold text-white">Tile Status</h2>
      <p className="mt-2 text-zinc-300">{statusText}</p>
      <p className="text-xs text-zinc-500">{fps ? `${fps} FPS` : "FPS unavailable"}</p>
      <div className="mt-4 text-xs text-zinc-400">
        {lease ? (
          <>
            <p>
              Tile {lease.tileX + 1},{lease.tileY + 1} of {lease.tilesX}×
              {lease.tilesY}
            </p>
            <p>Lease: {lease.tileId}</p>
          </>
        ) : (
          <p>No lease assigned yet.</p>
        )}
      </div>
    </div>
  );
}
