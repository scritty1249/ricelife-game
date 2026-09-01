import { Main } from "$engine/runtime/Core.js";
import { loading } from "./events/loading.js";
import { DiscordApp } from "./discord.js";
import { ENDPOINT, getLobby } from "./api/api.js";

const LOBBY_ID_PREFIX = "LOBBY_";
export const LOBBY_STATUS = {
    CLOSED: -1,
    WAITING: 0,
    ACTIVE: 1
};

export async function load () {
    const Discord = initDiscord();
    let userid;
    if (Discord?.isDiscordApp) {
        await Discord.onload;
        userid = Discord.user.id;
    } else {
        console.warn("!!! Discord embedded environment not found. Application may fail unexpectedly");
        userid = "";
    }
    
    const main = new Main(userid, loading);
    await main.onload;
    window._MAIN = main; // [!] for debug

    const URL_PARAMS = new URLSearchParams(window.location.search);
    const customID = URL_PARAMS.get("custom_id") || "";
    let phase;
    if (customID && customID.startsWith(LOBBY_ID_PREFIX)) {
        const lobbyid = customID.slice(LOBBY_ID_PREFIX.length);
        console.info(`Opening invite for lobby ${lobbyid}`);
        phase = await loadLobby(lobbyid, main, Discord);
    } else {
        const { default: init } = await import("./game/create.js");
        phase = await init(main, Discord);
    }
    main.Events.raiseEvent("LOADING", {hide: true});
    if (phase) main.ActivePhase = phase;
    main.Display.canvas.focus();
    main.loop();
}

function initDiscord () {
    return window.location.hostname.endsWith(".discordsays.com")
        ? new DiscordApp(ENDPOINT + "/discord/auth", [
            "identify",
            "guilds",
            "applications.commands"
        ]) : {};
}

async function loadLobby (lobbyid, mainController, Discord) {
    try {
        if (lobbyid) {
            mainController.Events.raiseEvent("LOADING", {hide: false, message: `Fetching lobby`});
            const lobbyData = await getLobby(lobbyid);
            mainController.Events.raiseEvent("LOADING", {hide: false, message: `Loading lobby menu`});
            if (lobbyData && "state" in lobbyData) {
                if (lobbyData.state === 1) {
                    console.debug(`Opening round for lobby ${lobbyid}`);
                    const { default: init } = await import("./game/round.js");
                    return await init(mainController, Discord, lobbyData, lobbyid);
                } else if (lobbyData.state === 0) {
                    console.debug(`Opening join screen for lobby ${lobbyid}`);
                    const { default: init } = await import("./game/join.js");
                    return await init(mainController, Discord, lobbyData, lobbyid);
                } else if (lobbyData.state === -1) {
                    console.log(`Lobby ${lobbyid} is already closed`);
                    mainController.Events.raiseEvent("LOADING", {hide: false, message: `Lobby is closed`, error: true});
                }
            } else {
                console.error("Server returned malformed lobby payload");
                mainController.Events.raiseEvent("LOADING", {hide: false, message: `Corrupted lobby data`, error: true});
            }
        } else {
            mainController.Events.raiseEvent("LOADING", {hide: false, message: `Invalid game invite`, error: true});
            console.error("Invalid lobby ID");
        }
    } catch (err) {
        console.error(err);
    }
}