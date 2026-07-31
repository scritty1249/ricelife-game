// import { MainLoop } from "./loop/loop.js";
// import { loading } from "../events/loading.js";
// import * as API from "../api/api.js";

// export async function load () {
//     const URL_PARAMS = new URLSearchParams(window.location.search);
//     const MAPS = await API.getMapLegend().maps;
//     const Main = new MainLoop(MAPS, loading);    
//     Main.flags.DEBUG = URL_PARAMS.has("debug") && URL_PARAMS.get("debug") === "true";
//     window._MAIN = Main; // [!] for debug
//     await Main.onload;
//     startMapPhase(Main);
//     Main.Display.canvas.focus();
//     Main.loop();
// }

// async function startMapPhase (main) {
//     const MAPS = await API.getMapLegend().maps;
//     main.Events.raiseEvent("PHASE_NEW", {Phase: 0, args: [MAPS], close: false });
// }
import { Main } from "../../ricelife-game/engine/runtime/Core.js";
import { loading } from "../../ricelife-game/client/scripts/events/loading.js";
import { stream, unpackPolygon } from "../../ricelife-game/client/scripts/api/unpack.js";

const lobby = {
    "players": {
        "0": {
            "position": [800, 1000],
            "data": {
                "ammo": ["basic"],
                "model": "basic",
                "profile": {
                    "name": "Blurple",
                    "avatar": "https://cdn.discordapp.com/embed/avatars/0.png",
                    "fontFamily": "serif",
                    "userid": "0"
                },
                "team": "0"
            },
            "hitpoints": [
            {
                "amount": 100,
                "max": 100,
                "regen": 0,
                "reserve": 0,
                "type": "Health",
                "increase": 1,
                "decrease": 1
            },
            {
                "amount": 20,
                "max": 20,
                "regen": 3.3333333333333335,
                "reserve": 0,
                "type": "Shield",
                "increase": 1,
                "decrease": 1
            }
            ]
        }
    },
    "activeplayer": "0",
    "state": 1,
    "teamsize": 1,
    "teamcount": 2,
    "channelid": "0"
};

export async function load () {
    const URL_PARAMS = new URLSearchParams(window.location.search);
    const main = new Main("0", loading);
    await main.onload;
    window._MAIN = main; // [!] for debug
    main.flags.DEBUG = true;

    const terrainBuffer = await stream("../api/staging/test-terrain.bin");
    const terrainData = unpackPolygon(terrainBuffer);
    main.ActivePhase = await main.loadRoundPhase(lobby, terrainData);
    main.Display.canvas.focus();
    main.loop();
}