import { load } from "./game/game.js";

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", load);
} else {
    load();
}
