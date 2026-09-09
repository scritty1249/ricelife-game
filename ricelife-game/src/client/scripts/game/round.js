import { ENDPOINT, TERRAIN_BUCKET_ROUTING_PREFIX, getTerrainUrl, stream } from "../api/api.js";

export default async function init (mainController, Discord, lobby, lobbyid) {
    mainController.Events.raiseEvent("LOADING", {hide: false, message: `Fetching data`});
    const turnDataBuffer = await getTurnData(lobbyid, Discord);
    if (!turnDataBuffer) return;
    mainController.Events.raiseEvent("LOADING", {hide: false, message: `Loading`});
    const phase = await mainController.loadRoundPhase(lobby, turnDataBuffer, lobbyid, !lobby.turns);
    phase.Events.addEventListener("TURNENDED", async (changes) => {
        console.info("Saving turn");
        const success = await updateLobby(changes, lobbyid, Discord.user.id);
        if (success) console.info("Saved turn");
        else console.info("Failed to save turn");
    }, { once: true });
    mainController.Events.raiseEvent("LOADING", {hide: true});
    return phase;
}

async function getTurnData (lobbyid, Discord) {
    const src = await getTerrainUrl(lobbyid, Discord.user.id);
    if (!src) return;
    try {
        const url = new URL(src);
        const buffer = await stream(TERRAIN_BUCKET_ROUTING_PREFIX + url.pathname + url.search);
        return buffer;
    } catch (err) {
        console.error(err);
    }
}

async function updateLobby (changes, lobbyid, userid) {
    const staging = await fetch(ENDPOINT + "/lobby/terrain/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            lobbyid: lobbyid,
            userid: userid
        })
    });
    if (!staging.ok) {
        console.error("Failed to authenticate with staging endpoint");
        return false;
    }
    const { url: dest, token } = await staging.json();
    const url = new URL(dest);
    const blob = new Blob([changes.recording], { type: "application/octet-stream" });
    const uploadResponse = await fetch(TERRAIN_BUCKET_ROUTING_PREFIX + url.pathname + url.search, {
        method: "PUT",
        headers: { "Content-Type": "application/octet-stream" },
        body: blob
    });
    if (!uploadResponse.ok) {
        console.error("Failed upload round changes");
        return false;
    }
    const commit = await fetch(ENDPOINT + "/lobby/round/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            token: token,
            lobbyid: lobbyid,
            players: changes.players
        })
    });
    if (!commit.ok) {
        console.error("Failed to post update to commit endpoint");
        return false;
    }
    return true;
}
