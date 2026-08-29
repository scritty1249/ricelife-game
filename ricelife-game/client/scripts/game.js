import { Main } from "/engine/runtime/Core.js";
import { loading } from "/scripts/events/loading.js";
import { DiscordApp } from "/dependencies/discord.js";
import { ENDPOINT } from "/scripts/api/api.js";

const Discord = new DiscordApp(ENDPOINT + "/discord/auth", [
    "identify",
    "guilds",
    "applications.commands"
]);

export async function load () {
    await Discord.onload;
    const main = new Main(Discord.user.id, loading);
    await main.onload;
    window._MAIN = main; // [!] for debug

    const URL_PARAMS = new URLSearchParams(window.location.search);
    const phaseArg = URL_PARAMS.get("phase");
    let phase;
    if (!phaseArg || phaseArg === "new") {
        const { default: init } = await import("/scripts/game/create.js");
        phase = await init(main, Discord);
    } else if (phaseArg === "join") {
        const { default: init } = await import("/scripts/game/round.js");
        phase = await init(main, Discord, URL_PARAMS.get(lobbyid));
    } else {
        console.error("Invalid phase");
    }
    if (phase) main.ActivePhase = phase;
    main.Display.canvas.focus();
    main.loop();
}
