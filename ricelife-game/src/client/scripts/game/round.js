import { ENDPOINT, getTerrainUrl } from "../api/api.js";
import { stream, unpackPolygon } from "../api/unpack.js";
import { packPolygon } from "../api/pack.js";


export default async function init (mainController, Discord, lobby, lobbyid) {
    mainController.Events.raiseEvent("LOADING", {hide: false, message: `Fetching data`});
    const terrain = await getTerrainData(lobbyid, Discord);
    if (!terrain) return;
    mainController.Events.raiseEvent("LOADING", {hide: false, message: `Loading`});
    const phase = await mainController.loadRoundPhase(lobby, terrain, lobbyid);
    phase.Events.addEventListener("TURNENDED", async (changes) => {
        console.info("Saving turn");
        const success = await updateLobby(changes, lobbyid, Discord.user.id);
        if (success) console.info("Saved turn");
        else console.info("Failed to save turn");
    }, { once: true });
    mainController.Events.raiseEvent("LOADING", {hide: true});
    return phase;
}

async function getTerrainData (lobbyid, Discord) {
    const src = await getTerrainUrl(lobbyid, Discord.user.id);
    if (!src) return;
    try {
        const prefix = "/terrain-bucket";
        const url = new URL(src);
        const terrainBuffer = await stream(prefix + url.pathname + url.search);
        const terrainData = unpackPolygon(terrainBuffer);
        return terrainData;
    } catch (err) {
        console.error(err);
    }
}

async function updateLobby (changes, lobbyid, userid) {
    const keep = !("terrain" in changes);
    const stagingPayload = {
        keep: keep,
        lobbyid: lobbyid,
        userid: userid
    };
    const staging = await fetch(ENDPOINT + "/lobby/terrain/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(stagingPayload)
    });
    if (!staging.ok) {
        console.error("Failed to authenticate with staging endpoint");
        return false;
    }
    const { url, token } = await staging.json();
    if (!keep) {
        const buffer = packPolygon(changes.terrain.polygon);
        const blob = new Blob([buffer], { type: "application/octet-stream" });
        const response = await fetch(url, {
            method: "PUT",
            headers: { "Content-Type": "application/octet-stream" },
            body: blob
        });
        if (!response.ok) {
            console.error("Failed upload terrain");
            return false;
        }
    }
    const commitPayload = {
        token: token,
        lobbyid: lobbyid,
        players: changes.players || []
    };
    const commit = await fetch(ENDPOINT + "/lobby/round/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(commitPayload)
    });
    if (!commit.ok) {
        console.error("Failed to post update to commit endpoint");
        return false;
    }
    return true;
}
