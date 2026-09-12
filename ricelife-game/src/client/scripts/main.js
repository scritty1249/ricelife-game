import { load } from "./game.js";
import * as loading from "./events/loading.js";
import * as notify from "./events/notify.js";

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSequence);
} else {
    initSequence();
}

function hookAppCanvas () { window.appCanvas = document.getElementById("app") }

function initSequence () {
    hookAppCanvas();
    loading.init();
    notify.init();
    load().catch((error) => {
        console.error(error);
        loading.loading({hide: false, message: "crashed on startup", error: true});
        throw error;
    });
}
