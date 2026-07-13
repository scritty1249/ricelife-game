import { MainController } from "./controller/controller.js";
import { RoundController } from "./controller/loop/round.js"; // [!] testing
import { SelectionController, ShotSelection } from "./controller/loop/select.js"; // [!] testing
// [!] only for client demo
import LOBBY_DATA from "./lobby/testlobby.json" with { type: "json" }; 

export async function load () {
    const URL_PARAMS = new URLSearchParams(window.location.search);
    const Main = new MainController();
    Main.flags.DEBUG = URL_PARAMS.has("debug") && URL_PARAMS.get("debug") === "true";
    window._MAIN = Main; // [!] for debug
    await Main.onload;
    Main.transferLoop(new RoundController(Main, LOBBY_DATA));
    Main.Display.canvas.focus();
    Main.loop();
}
