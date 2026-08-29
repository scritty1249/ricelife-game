import { Main } from "/engine/runtime/Core.js";
import { loading } from "/scripts/events/loading.js";
import { DiscordApp } from "/dependencies/discord.js";
import { ENDPOINT } from "/scripts/api/api.js";

const Discord = new DiscordApp(ENDPOINT + "/discord/auth", [
    "identify",
    "guilds",
    "applications.commands"
]);

const LOBBY_ID_PREFIX = "LOBBY_";

export async function load () {
    await Discord.onload;
    const main = new Main(Discord.user.id, loading);
    await main.onload;
    window._MAIN = main; // [!] for debug

    const URL_PARAMS = new URLSearchParams(window.location.search);
    const customID = URL_PARAMS.get("custom_id") || "";
    let phase;
    if (customID && customID.startsWith(LOBBY_ID_PREFIX)) {
        const lobbyid = customID.slice(LOBBY_ID_PREFIX.length);
        const { default: init } = await import("/scripts/game/round.js");
        phase = await init(main, Discord, lobbyid);
    } else {
        const { default: init } = await import("/scripts/game/create.js");
        phase = await init(main, Discord);
    }
    if (phase) main.ActivePhase = phase;
    main.Display.canvas.focus();
    main.loop();
}
