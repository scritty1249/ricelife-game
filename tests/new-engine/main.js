import { load } from "./game.js";
import { init, loading } from "../../ricelife-game/client/scripts/events/loading.js";

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSequence);
} else {
    initSequence();
}

function hookAppCanvas () { window.appCanvas = document.getElementById("app") }

function initSequence () {
    hookAppCanvas();
    init();
    load().catch((error) => {
        console.error(error);
        loading({hide: false, message: "crashed on startup", error: true});
        throw error;
    });
}
