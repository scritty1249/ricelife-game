import { ENDPOINT } from "/scripts/api/api.js";

export default async function init (mainController, Discord) {
    mainController.Events.raiseEvent("LOADING", {hide: false, message: "Fetching maps"});
    const maps = await fetchMaps();
    mainController.Events.raiseEvent("LOADING", {hide: false, message: "Loading"});
    const phase = await mainController.loadCreatePhase(maps);
    phase.Events.addEventListener("SELECTED", async (selected) => {
        try {
            mainController.Events.raiseEvent("LOADING", {hide: false, message: "Creating lobby"});
            const { teamCount, teamSize, map } = selected;
            const userprofile = Discord.profiles.get(Discord.user.id);
            const lobbyid = await createLobby({
                mapid: map.id,
                channelid: Discord.sdk.channelId,
                teamsize: teamSize,
                teamcount: teamCount,
                player: userprofile
            });
            mainController.Events.raiseEvent("LOADING", {hide: true});
            if (lobbyid) {
                Discord.shareLink({ phase: "join", lobbyid }, `Join ${userprofile.name}'s lobby`);
                console.info(`Lobby ${lobbyid} created`);
            } else {
                console.error("Server failed to create lobby");
            }
        } catch (err) {
            console.error(err);
            mainController.Events.raiseEvent("LOADING", {hide: false, message: "Fatal error", error: true});
        }
    }, { once: true });
    return phase;
}

const MAP_PATH = "/assets/map-thumbnails/";

async function fetchMaps () {
    const { default: maps = []} = await import("/data/map-manifest.json", { with: { type: "json" } });
    if (maps?.length) {
        for (const map of maps) {
            map.thumb = MAP_PATH + `${map.id}.png`;
        }
    }
    return maps;
}

async function createLobby (payload) {
    const response = await fetch(ENDPOINT + "/lobby/new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (response.ok) {
        const { lobbyid = undefined } = await response.json();
        return lobbyid;
    }
}