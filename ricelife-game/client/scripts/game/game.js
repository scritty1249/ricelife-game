import { MainLoop } from "./loop/loop.js";
import { loading } from "../events/loading.js";
import * as API from "../api/api.js";

export async function load () {
    const URL_PARAMS = new URLSearchParams(window.location.search);
    const MAPS = await API.getMapLegend().maps;
    const Main = new MainLoop(MAPS, loading);    
    Main.flags.DEBUG = URL_PARAMS.has("debug") && URL_PARAMS.get("debug") === "true";
    window._MAIN = Main; // [!] for debug
    await Main.onload;
    startMapPhase(Main);
    Main.Display.canvas.focus();
    Main.loop();
}

async function startMapPhase (main) {
    const MAPS = await API.getMapLegend().maps;
    main.Events.raiseEvent("PHASE_NEW", {Phase: 0, args: [MAPS], close: false });
}
