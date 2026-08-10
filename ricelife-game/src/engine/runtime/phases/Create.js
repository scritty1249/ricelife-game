import {
    Phase
} from "../../core/Core.js";
import { MapSelect } from "../menus/MapSelect.js";

export class Create extends Phase {
    static #selectedCallbackOptions = {
        once: true
    };
    constructor (mainController, maps) {
        super(mainController);
        this.#init(maps)
        this.#load()
            .then(() => this.resolveLoad())
            .catch((err) => this.rejectLoad(err));
        this.onload.then(() => this.onResize());
    }

    #init (maps) {
        this.Camera.Viewbox.bounding.left = this.Camera.Viewbox.bounding.right = false;
        this.Menus.set("Maps", new MapSelect(this, maps));
    }
    async #load () {
        this.store.menu = await this.Menus.get("Maps").onload;
    }
    #onMapSelected (selected) {
        this.Events.raiseEvent("SELECTED", selected);
    }

    onanimate () {
        const { menu } = this.store;
        if (!menu?.isOpen) this.Camera.update();
    }
    start () {
        // attach per start, consume on trigger. Prevent multiple map loads from being queued up at the same time
        this.store.menu.Events.addEventListener("SELECTED", (data) => this.#onMapSelected(data), Create.#selectedCallbackOptions);
        this.store.menu.open();
        super.start();
    }
    reset () {
        super.reset();
        this.store.menu.close();
    }
}