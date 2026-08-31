export const ENDPOINT = window.origin + "/api";

export async function getLobby (lobbyid) {
    if (!lobbyid) return;
    const response = await fetch(ENDPOINT + `/lobby/info?lobbyid=${lobbyid}`);
    if (response.ok) {
        const { lobby = undefined } = await response.json();
        return lobby;
    }
}

export async function getTerrainUrl (lobbyid, userid) {
    if (!lobbyid || !userid) return;
    const response = await fetch(ENDPOINT + `/lobby/terrain/auth?lobbyid=${lobbyid}&userid=${userid}`);
    if (response.ok) {
        const { url = undefined } = await response.json();
        return url;
    }
}

export async function joinLobby (lobbyid, teamid, profile) {
    if (!lobbyid || !userid || !profile) return false;
    const response = await fetch(ENDPOINT + `/lobby/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            lobbyid, teamid, player: profile
        })
    });
    if (response.ok) {
        const { success = false } = await response.json();
        return success;
    }
    return false;
}
