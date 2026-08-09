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

const maps = [
    {
        "name": "Test Map",
        "src": "../api/staging/test-terrain.bin",
        "thumb": "data:image/png;base64,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"
    },
    {
        "name": "Test Map 2",
        "src": "../api/staging/test-terrain.bin",
        "thumb": "data:image/png;base64,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"
    },
]

export async function load () {
    const URL_PARAMS = new URLSearchParams(window.location.search);
    const main = new Main("0", loading);
    await main.onload;
    window._MAIN = main; // [!] for debug
    main.flags.DEBUG = true;

    if (true) {
        const terrainBuffer = await stream("../api/staging/test-terrain.bin");
        const terrainData = unpackPolygon(terrainBuffer);
        main.ActivePhase = await main.loadRoundPhase(lobby, terrainData);
    } else if (true) {
        main.ActivePhase = await main.loadCreatePhase(maps);
    }

    main.Display.canvas.focus();
    main.loop();
}