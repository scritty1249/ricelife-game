import { load } from "./game/game.js";
import { init, showErrorScreen } from "./events/loading.js";

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
        showErrorScreen();
        throw error;
    });
}
