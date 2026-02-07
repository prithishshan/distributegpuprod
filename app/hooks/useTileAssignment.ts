"use client";

import { useEffect, useState } from "react";
import type { TileLease } from "@/lib/tileCoordinator";

type UseTileAssignmentOptions = {
  tilesX: number;
  tilesY: number;
  clientId: string;
};

export function useTileAssignment({
  tilesX,
  tilesY,
  clientId,
}: UseTileAssignmentOptions) {
  const [lease, setLease] = useState<TileLease | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let heartbeatTimer: number | undefined;

    const assign = async () => {
      try {
        const response = await fetch("/api/tiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId, tilesX, tilesY }),
        });
        const data = (await response.json()) as { lease?: TileLease; error?: string };
        if (!response.ok || !data.lease) {
          throw new Error(data.error || "Failed to acquire tile.");
        }
        if (!active) return;
        setLease(data.lease);
        heartbeatTimer = window.setInterval(() => {
          fetch("/api/tiles/heartbeat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ clientId, tileId: data.lease?.tileId }),
          }).catch(() => undefined);
        }, 5_000);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    };

    assign();

    return () => {
      active = false;
      if (heartbeatTimer) {
        window.clearInterval(heartbeatTimer);
      }
    };
  }, [clientId, tilesX, tilesY]);

  return { lease, error };
}
