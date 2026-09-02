import { BoundingBox } from "../../geometry/BoundingBox.js";
import { Vector } from "../../math/Vector.js";
import { Canvas2DContextCursor } from "./Canvas2DContextCursor.js";
import { Hashable } from "../../math/Hash.js";

export class AppCanvas extends Hashable {
    #cursor;
    #window;
    #ratio = 1;
    #bbox = new BoundingBox();
    #rawSizeHash;
    #size = new Vector();
    #resizeCallbacks = new Set();
    #center = new Vector();
    constructor (canvas, window) {
        super();
        this.canvas = canvas;
        this.#window = window;
        this.#attachResizeListener();
        this.#computeLayout();
        this.#cursor = new Canvas2DContextCursor(this.canvas);
    }

    #attachResizeListener () {
        if (this.window.visualViewport) this.window.visualViewport.addEventListener("resize", this.#onResize);
        else this.window.addEventListener("resize", this.#onResize);
    }
    #onResize = () => {
        this.#computeLayout();
        for (const callback of this.#resizeCallbacks)
            callback?.(this);
    }
    #computeLayout () {
        let width = this.window.innerWidth, height = this.window.innerHeight;
        if (this.window.visualViewport) {
            width = this.window.visualViewport.width;
            height = this.window.visualViewport.height;
        }
        this.size.apply(width, height).floor(true);
        ({x: this.canvas.width, y: this.canvas.height} = this.size);
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
    get pixelRatio () { return this.window.devicePixelRatio || 1 }
}
