export type TileLease = {
  tileId: string;
  tileX: number;
  tileY: number;
  tilesX: number;
  tilesY: number;
  assignedAt: number;
  lastSeen: number;
  clientId: string;
};

type CoordinatorState = {
  tilesX: number;
  tilesY: number;
  leases: Map<string, TileLease>;
};

const state: CoordinatorState = {
  tilesX: 4,
  tilesY: 4,
  leases: new Map<string, TileLease>(),
};

const LEASE_TIMEOUT_MS = 20_000;

function tileId(tileX: number, tileY: number) {
  return `${tileX}-${tileY}`;
}

export function configureGrid(tilesX: number, tilesY: number) {
  state.tilesX = Math.max(1, tilesX);
  state.tilesY = Math.max(1, tilesY);
}

export function listLeases() {
  return Array.from(state.leases.values());
}

export function heartbeat(tileIdValue: string, clientId: string) {
  const lease = state.leases.get(tileIdValue);
  if (!lease || lease.clientId !== clientId) {
    return null;
  }
  lease.lastSeen = Date.now();
  return lease;
}

export function release(tileIdValue: string, clientId: string) {
  const lease = state.leases.get(tileIdValue);
  if (!lease || lease.clientId !== clientId) {
    return false;
  }
  state.leases.delete(tileIdValue);
  return true;
}

export function assignTile(clientId: string): TileLease {
  const now = Date.now();
  for (const lease of state.leases.values()) {
    if (now - lease.lastSeen > LEASE_TIMEOUT_MS) {
      state.leases.delete(lease.tileId);
    }
  }

  for (let y = 0; y < state.tilesY; y += 1) {
    for (let x = 0; x < state.tilesX; x += 1) {
      const id = tileId(x, y);
      if (!state.leases.has(id)) {
        const lease: TileLease = {
          tileId: id,
          tileX: x,
          tileY: y,
          tilesX: state.tilesX,
          tilesY: state.tilesY,
          assignedAt: now,
          lastSeen: now,
          clientId,
        };
        state.leases.set(id, lease);
        return lease;
      }
    }
  }

  const existing = Array.from(state.leases.values()).sort(
    (a, b) => a.lastSeen - b.lastSeen
  )[0];
  if (!existing) {
    throw new Error("No tiles available.");
  }
  existing.clientId = clientId;
  existing.lastSeen = now;
  return existing;
}
