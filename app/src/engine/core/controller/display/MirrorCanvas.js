import { AppCanvas } from "./AppCanvas.js";

export class MirrorCanvas extends AppCanvas {
    #target;
    constructor (appCanvas) {
        super(new OffscreenCanvas(1, 1), appCanvas.window);
        this.#target = appCanvas;
        this.onResize(false);
    }

    get isMirrorCanvas () { return true }
    get target () { return this.#target }
    get domWidth () { return this.target.domWidth }
    get domHeight () { return this.target.domHeight }
}
