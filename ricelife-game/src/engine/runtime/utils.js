import { Terrain, Polygon, Lobby } from "../core/Core.js";

export function initTerrain (decodedTerrainPoly) {
    return Terrain.fromObject({polygon: decodedTerrainPoly});
}

export function initLobby (lobbyJson) {
    return Lobby.fromObject(lobbyJson);
}