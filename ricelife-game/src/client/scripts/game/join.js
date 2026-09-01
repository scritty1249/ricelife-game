import { ENDPOINT } from "../api/api.js";

export default async function init (mainController, Discord, lobby, lobbyid, isHost) {
    mainController.Events.raiseEvent("LOADING", {hide: false, message: `Loading participants`});
    const phase = await mainController.loadJoinPhase(lobby, isHost);
    phase.Events.addEventListener("JOIN", async ({team}) => {
        try {
            mainController.Events.raiseEvent("LOADING", {hide: false, message: "Joining lobby"});
            const userprofile = Discord.profiles.get(Discord.user.id);
            const success = await joinLobby({
                player: userprofile,
                teamid: team,
                lobbyid: lobbyid
            });
            mainController.Events.raiseEvent("LOADING", {hide: true});
            if (success) {
                console.info(`Lobby ${lobbyid} joined`);
            } else {
                console.error("Failed to join lobby - API error");
                setTimeout(() => phase.setJoinButtonVisibility(true), 1500);
            }
        } catch (err) {
            console.error(err);
            mainController.Events.raiseEvent("LOADING", {hide: false, message: "Fatal error", error: true});
        }
    }, { once: false });
    phase.Events.addEventListener("START", async () => {
        try {
            mainController.Events.raiseEvent("LOADING", {hide: false, message: "Starting lobby"});
            const success = await startLobby({
                hostid: Discord.user.id,
                lobbyid: lobbyid
            });
            mainController.Events.raiseEvent("LOADING", {hide: true});
            if (success) {
                console.info(`Lobby ${lobbyid} started`);
                Discord.closeApp("Lobby started");
            } else {
                console.error("Failed to start lobby");
                setTimeout(() => phase.setStartButtonVisibility(phase.isClientHost), 1500);
            }
        } catch (err) {
            console.error(err);
            mainController.Events.raiseEvent("LOADING", {hide: false, message: "Fatal error", error: true});
        }
    }, { once: false });
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

async function startLobby (payload) {
    const response = await fetch(ENDPOINT + "/lobby/start", {
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
