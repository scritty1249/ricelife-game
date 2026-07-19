import { Interface } from "../../menu/menu.js";
import { LoopController } from "./loop.js";
import { BoundingBox } from "../../geometry/geometry.js";

export class PhaseController extends LoopController {
    #Global;
    #Interface;
    #Plane = new BoundingBox();
    constructor (mainController) {
        super(mainController.Audio.Context);
        this.#Global = mainController;
        this.#Interface = new Interface();
        this.store.EXPORT = null;
    }
    animate (clear = true) {}
    get isPhaseController () { return true }
    get Global () { return this.#Global }
    get Interface () { return this.#Interface }
    get Plane () { return this.#Plane }
    get EXPORT () { return this.store.EXPORT }
}
