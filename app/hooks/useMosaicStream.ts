"use client";

import { useEffect, useState } from "react";
import type { TileSnapshot } from "@/lib/mosaicStore";
import type { TileLease } from "@/lib/tileCoordinator";

type MosaicStats = {
  clientCount: number;
  tilesX: number;
  tilesY: number;
};

export function useMosaicStream() {
  const [tiles, setTiles] = useState<TileSnapshot[]>([]);
  const [stats, setStats] = useState<MosaicStats>({
    clientCount: 0,
    tilesX: 1,
    tilesY: 1,
  });

  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const [mosaicRes, tilesRes] = await Promise.all([
          fetch("/api/mosaic"),
          fetch("/api/tiles"),
        ]);
        const mosaicData = (await mosaicRes.json()) as { tiles?: TileSnapshot[] };
        const tilesData = (await tilesRes.json()) as { leases?: TileLease[] };
        if (!active) return;
        const leases = tilesData.leases ?? [];
        const firstLease = leases[0];
        setTiles(mosaicData.tiles ?? []);
        setStats({
          clientCount: leases.length,
          tilesX: firstLease?.tilesX ?? 1,
          tilesY: firstLease?.tilesY ?? 1,
        });
      } catch {
        if (!active) return;
        setStats((prev) => ({ ...prev }));
      }
    };

    poll();
    const timer = window.setInterval(poll, 2000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  return { tiles, stats };
}
