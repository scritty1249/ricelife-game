import { BoundingBox } from "../../geometry/BoundingBox.js";
import { Vector } from "../../math/Vector.js";
import { Canvas2DContextCursor } from "./Canvas2DContextCursor.js";
import { Hashable } from "../../math/Hash.js";

export class AppCanvas extends Hashable {
    #cursor;
    #window;
    #ratio = 1;
    #Viewbox;
    #bbox = new BoundingBox();
    #rawSizeHash;
    #size = new Vector();
    #resizeCallbacks = new Set();
    #center = new Vector();
    constructor (canvas, window) {
        super();
        this.canvas = canvas;
        this.#window = window;
        this.window.addEventListener("resize", this.#onResize);
        this.#computeLayout();
        this.#cursor = new Canvas2DContextCursor(this.canvas);
    }

    #onResize = () => {
        this.#computeLayout();
        for (const callback of this.#resizeCallbacks)
            callback?.(this);
    }
    #computeLayout () {
        const width = this.window.innerWidth;
        const height = this.window.innerHeight;
        this.canvas.width = width;
        this.canvas.height = height;
        this.size.apply(width, height);
        this.center.apply(this.size.div(2));
        this.#bbox.apply(undefined, this.size);
        this.#rawSizeHash = this.#bbox.rawHash;
        this.#ratio = this.size.quot();
    }

    getBoundingBox () {
        return this.#bbox;
    }
    removeResizeListener (handler) {
        this.#resizeCallbacks.delete(handler);
    }
    addResizeListener (handler) {
        this.#resizeCallbacks.add(handler);
    }

    get isAppCanvas () { return true }
    get cursor () { return this.#cursor }
    get size () { return this.#size }
    get aspectRatio () { return this.#ratio }
    get center () { return this.#center }
    get window () { return this.#window }
    get isPortrait () { return this.#size.x < this.#size.y }
    get isLandscape () { return this.#size.y < this.#size.x }
    get rawHash () { return this.#rawSizeHash }
}
