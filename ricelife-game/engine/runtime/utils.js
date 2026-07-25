import { Terrain, Lobby } from "../core/Core.js";

export function initTerrain (decodedTerrain) {
    return Terrain.fromObject(decodedTerrain);
}

export function initLobby (lobbyJson) {
    return Lobby.fromObject(lobbyJson);
}