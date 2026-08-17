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
    #sizeLimits = {
        width: 0,
        height: 0,
        totalPixels: 0
    };
    constructor (canvas, window) {
        super();
        this.canvas = canvas;
        this.#window = window;
        this.window.addEventListener("resize", this.#onResize);
        this.#computeLayout();
        this.#cursor = new Canvas2DContextCursor(this.canvas, undefined, undefined, this.pixelRatio);
    }

    #onResize = () => {
        this.#computeLayout();
        for (const callback of this.#resizeCallbacks)
            callback?.(this);
    }
    #computeLayout () {
        // compute dimensions, downscale if needed to remain within limits
        const dpr = this.pixelRatio;
        const limits = this.#sizeLimits;
        let width = this.window.innerWidth * dpr;
        let height = this.window.innerHeight * dpr;
        if ((limits.totalPixels && width * height > limits.totalPixels)
            || (limits.width && width > limits.width)
            || (limits.height && height > limits.height)
        ) {
            const scale = Math.min(limits.width / width, limits.height / height);
            if (scale) {
                width = Math.floor(width * scale);
                height = Math.floor(height * scale);
            }
        }
        // apply dimensions
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
    get pixelRatio () { return this.window.devicePixelRatio || 1 }
}
