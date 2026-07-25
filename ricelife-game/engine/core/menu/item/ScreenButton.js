import { Button } from "./Button.js";
import { BoundingBox } from "../../Core.js";
import { typeString } from "../../utils/logging.js";

export class ScreenButton extends Button {
    draw = undefined; // override parent method to hide this button
    #bbox = new BoundingBox();
    #appCavnas;
    constructor (appCanvas) {
        super();
        if (!appCanvas?.isAppCanvas) throw new Error(`[${typeString(this)}]: Expected AppCanvas, got ${typeString(appCanvas)}`);
        this.#appCavnas = appCanvas;
        this.#appCavnas.addResizeListener(this.#onResize);
        this.#onResize();
    }

    #onResize = () => { this.#bbox.max.apply(this.#appCavnas.size) }
    isOver (point) { return this.#bbox.isIntersecting(point) }
    close () { this.#appCavnas.removeResizeListener(this.#onResize) }

    get isScreenButton () { return true }
}