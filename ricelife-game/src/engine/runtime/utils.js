import { Terrain, Lobby } from "../core/Core.js";

export function initTerrain (decodedTerrainPoly) {
    return Terrain.fromObject({polygon: decodedTerrainPoly});
}

export function initLobby (lobbyJson) {
    return Lobby.fromObject(lobbyJson);
}

export const WEB_WORKER_PATH = window.__WEB_WORKER_PATH;