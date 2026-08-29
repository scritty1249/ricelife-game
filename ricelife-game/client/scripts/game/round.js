import { getLobby, getTerrainUrl } from "/scripts/api/api.js";
import { stream, unpackPolygon } from "/scripts/api/unpack.js";

export default async function init (mainController, Discord, lobby, lobbyid) {
    mainController.Events.raiseEvent("LOADING", {hide: false, message: `Fetching data`});
    const terrain = await getTerrainData(lobbyid, Discord);
    if (!terrain) return;
    mainController.Events.raiseEvent("LOADING", {hide: false, message: `Loading`});
    const phase = await mainController.loadRoundPhase(lobby, terrain, false);
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
        const terrainData = await unpackPolygon(terrainBuffer);
        return terrainData;
    } catch (err) {
        console.error(err);
    }
}
