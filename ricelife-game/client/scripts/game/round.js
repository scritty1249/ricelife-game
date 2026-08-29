import { ENDPOINT } from "/scripts/api/api.js";
import { stream, unpackPolygon } from "/scripts/api/unpack.js";

export default async function init (mainController, Discord, lobbyid) {
    mainController.Events.raiseEvent("LOADING", {hide: false, message: `Fetching lobby`});
    const [ lobby, terrain ] = await Promise.all([
        getLobbyData(lobbyid),
        getTerrainData(lobbyid, Discord)
    ]);
    if (!lobby || !terrain) return;
    mainController.Events.raiseEvent("LOADING", {hide: false, message: `Loading`});
    const phase = await mainController.loadRoundPhase(lobby, terrain, false);
    mainController.Events.raiseEvent("LOADING", {hide: true});
    return phase;
}

async function getLobbyData (lobbyid) {
    if (!lobbyid) return;
    const response = await fetch(ENDPOINT + `/lobby/info?lobbyid=${lobbyid}`);
    if (response.ok) {
        const { lobby = undefined } = await response.json();
        return lobby;
    }
}

async function getTerrainData (lobbyid, Discord) {
    const src = await getTerrainUrl(lobbyid, Discord.user.id);
    if (!src) return;
    try {
        const prefix = "/DOWNLOAD_TERRAIN";
        const url = new URL(src);
        Discord.registerExternalEndpoints([prefix, url.hostname]);
        const terrainBuffer = await stream(prefix + url.pathname + url.search);
        const terrainData = await unpackPolygon(terrainBuffer);
        return terrainData;
    } catch (err) {
        console.error(err);
    }
}

async function getTerrainUrl (lobbyid, userid) {
    if (!lobbyid || !userid) return;
    const response = await fetch(ENDPOINT + `/lobby/terrain/auth?lobbyid=${lobbyid}&userid=${userid}`);
    if (response.ok) {
        const { url = undefined } = await response.json();
        return url;
    }
}