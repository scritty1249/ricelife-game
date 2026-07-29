import { PointerInterface } from "../input/interface/PointerInterface.js";
import { BoundingBox } from "../geometry/BoundingBox.js";
import { Loop } from "./loop/Loop.js";
import { Camera } from "./display/Camera.js";

// exists within Main loop only
// uses ontick and onanimate instead of tick and animate
export class Phase extends Loop {
    static INPUT_MAP = {};
    #Menus = new Map();
    #Interface = new PointerInterface();
    #Plane = new BoundingBox();
    #Camera;
    #Global;
    constructor (mainController) {
        super(mainController.Audio.Context);
        this.#Global = mainController;
        this.#Camera = new Camera(this.Global.Display);
        this.onload.then(() => {
            this.Camera.Viewbox.setPlane(this.Plane);
        });
    }
    drawBackground () {}
    onanimate () {}
    animate (clear = true) {
        if (clear) this.Global.Display.cursor.clear();
        const openMenus = this.Menus
            .values()
            .filter(({isOpen}) => isOpen);
        if (openMenus?.length) {
            this.drawBackground();
            for (const menu of openMenus)
                menu.animate(false);
        } else
            this.onanimate();
    }
    start () {
        this.state = this.constructor.STATES.Ready;
    }
    reset () {
        this.state = this.constructor.STATES.Busy;
    }
    async ontick (delta) {}
    async tick (delta) {
        super.tick(delta);
        const openMenus = this.Menus
            .values()
            .filter(({isOpen}) => isOpen);
        if (openMenus?.length)
            await Promise.all(openMenus.map((menu) => menu?.tick?.(delta)));
        else
            await this.ontick?.(delta);
    }
    get isPhase () { return true }
    get Global () { return this.#Global }
    get Interface () { return this.#Interface }
    get Plane () { return this.#Plane }
    get Camera () { return this.#Camera }
    get Menus () { return this.#Menus }
}
