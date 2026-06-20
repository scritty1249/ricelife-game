import { load } from "./game/mainloop.js";

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", load);
} else {
    load();
}
