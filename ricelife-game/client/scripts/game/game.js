import { MainController } from "./controller/controller.js";
import { RoundController } from "./controller/loop/round.js"; // [!] testing
// [!] only for client demo
import LOBBY_DATA from "./lobby/testlobby.json" with { type: "json" }; 

export async function load () {
    const Main = new MainController();
    await Main.onload;
    Main.transferLoop(new RoundController(Main, LOBBY_DATA));
    Main.loop();
}
