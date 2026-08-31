import { ENDPOINT } from "../api/api.js";

export default async function init (mainController, Discord, lobby, lobbyid) {
    mainController.Events.raiseEvent("LOADING", {hide: false, message: `Loading participants`});
    const phase = await mainController.loadJoinPhase(lobby);
    phase.Events.addEventListener("JOIN", async () => {
        try {
            mainController.Events.raiseEvent("LOADING", {hide: false, message: "Joining lobby"});
            const userprofile = Discord.profiles.get(Discord.user.id);
            const success = await joinLobby({
                player: userprofile,
                teamid: "1", // [!] placeholder
                lobbyid: lobbyid
            });
            mainController.Events.raiseEvent("LOADING", {hide: true});
            if (success) {
                console.info(`Lobby ${lobbyid} joined`);
                Discord.closeApp("Lobby joined");
            } else {
                console.error("Failed to join lobby - API error");
            }
        } catch (err) {
            console.error(err);
            mainController.Events.raiseEvent("LOADING", {hide: false, message: "Fatal error", error: true});
        }
    }, { once: true });
    mainController.Events.raiseEvent("LOADING", {hide: true});
    return phase;
}

async function joinLobby (payload) {
    const response = await fetch(ENDPOINT + "/lobby/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (response.ok) {
        const { success = false } = await response.json();
        return success;
    }
    return false;
}
