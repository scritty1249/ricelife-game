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
        this.onload.then(() => this.#postLoad());
    }

    #init (maps) {
        this.Menus.set("Maps", new MapSelect(this, maps));
    }
    async #load () {
        await this.Menus.get("Maps").onload;
    }
    #postLoad () {
        this.onResize();
    }

    onResize () {
        // const plane = this.Global.Display.getBoundingBox()
        // this.Plane.apply(plane);
        // this.Camera.Viewbox.setPlane(this.Plane);
        super.onResize();
    }
    onanimate () {
        const menu = this.Menus.get("Maps");
        const { cursor } = this.Global.Display;
        const { Viewbox } = this.Camera;
        this.Camera.update();
        Viewbox.setCursor(cursor, true);
        cursor.fillStyle = "rgba(0, 0, 255, 0.4)";
        menu.Area.draw(cursor, true);
        cursor.fill();
        cursor.restore();
    }
    start () {
        this.Menus.get("Maps").open();
        super.start();
    }
}