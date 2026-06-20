import { load } from "./game/game.js";

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => { hookAppCanvas(); load() });
} else {
    hookAppCanvas();
    load();
}

function hookAppCanvas () { window.appCanvas = document.getElementById("app") }
