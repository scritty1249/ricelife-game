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
        this.onload.then(() => this.Menus.get("Maps").open());
    }

    #init (maps) {
        this.Menus.set("Maps", new MapSelect(this, maps));
    }
    async #load () {
        await this.Menus.get("Maps").onload;
    }

    onResize = () => {
        // const plane = this.Global.Display.getBoundingBox()
        // this.Plane.apply(plane);
        // this.Camera.Viewbox.setPlane(this.Plane);
        super.onResize();
    }
    onanimate () {
        const menu = this.Menus.get("Maps");
        const { cursor } = this.Global.Display;
        const { Viewbox } = this.Camera;
        Viewbox.setCursor(cursor, true);
        cursor.fillStyle = "rgba(0, 0, 255, 0.4)";
        menu.Area.draw(cursor, true);
        cursor.fill();
        cursor.restore();
        super.onanimate();
    }
}