import {
    Phase
} from "../../core/Core.js";
import { MapSelect } from "../menus/MapSelect.js";

export class Create extends Phase {
    constructor (mainController, maps) {
        super(mainController);
        this.#init(maps)
        this.#load()
            .then(() => this.resolveLoad())
            .catch((err) => this.rejectLoad(err));
    }

    #init (maps) {
        this.Menus.set("Maps", new MapSelect(this, maps));
    }
    async #load () {
        await this.Menus.get("Maps").onload
            .then((menu) => menu.open());
    }
}