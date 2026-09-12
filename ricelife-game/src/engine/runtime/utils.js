import { Lobby } from "../core/Core.js";

export function initLobby (lobbyJson) {
    return Lobby.fromObject(lobbyJson);
}

export const WEB_WORKER_PATH = window.__WEB_WORKER_PATH;