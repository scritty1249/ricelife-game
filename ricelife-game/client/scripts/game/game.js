import { MainController } from "./controller/controller.js";
import { RoundController } from "./controller/loop/round.js"; // [!] testing

// [!] only for client demo
const LOBBY_URL = "../tests/test-lobby.json";
const TERRAIN_URL = "../maps/the-finger.csv";

export async function load () {
    const URL_PARAMS = new URLSearchParams(window.location.search);
    const Main = new MainController();
    Main.flags.DEBUG = URL_PARAMS.has("debug") && URL_PARAMS.get("debug") === "true";
    window._MAIN = Main; // [!] for debug
    await Main.onload;
    Main.transferLoop(new RoundController(Main, LOBBY_URL, TERRAIN_URL));
    Main.Display.canvas.focus();
    Main.loop();
}
