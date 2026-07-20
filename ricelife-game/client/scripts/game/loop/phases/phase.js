import { Interface } from "../../menu/menu.js";
import { BoundingBox } from "../../geometry/geometry.js";
import { GameLoop } from "../gameloop.js";

export class Phase extends GameLoop {
    static INPUT_MAP = {};
    #Global;
    #Interface;
    #Plane = new BoundingBox();
    constructor (mainController) {
        super(mainController.Audio.Context);
        this.#Global = mainController;
        this.#Interface = new Interface();
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
}
