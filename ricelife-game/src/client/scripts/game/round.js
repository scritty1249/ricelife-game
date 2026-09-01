import { getTerrainUrl } from "../api/api.js";
import { stream, unpackPolygon } from "../api/unpack.js";

export default async function init (mainController, Discord, lobby, lobbyid) {
    mainController.Events.raiseEvent("LOADING", {hide: false, message: `Fetching data`});
    const terrain = await getTerrainData(lobbyid, Discord);
    if (!terrain) return;
    mainController.Events.raiseEvent("LOADING", {hide: false, message: `Loading`});
    const phase = await mainController.loadRoundPhase(lobby, terrain, lobbyid);
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
