import { PointerInterface } from "../input/interface/PointerInterface.js";
import { BoundingBox } from "../geometry/BoundingBox.js";
import { Loop } from "./loop/Loop.js";
import { Camera } from "./display/Camera.js";

// exists within Main loop only
export class Phase extends Loop {
    static INPUT_MAP = {};
    #Menus = {};
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
    animate (clear = true) {}
    start () {
        this.state = this.constructor.STATES.Ready;
    }
    reset () {
        this.state = this.constructor.STATES.Busy;
    }
    get isPhase () { return true }
    get Global () { return this.#Global }
    get Interface () { return this.#Interface }
    get Plane () { return this.#Plane }
    get Camera () { return this.#Camera }
}
