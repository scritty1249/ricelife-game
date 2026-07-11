import { Vector, BoundingBox } from "../geometry/geometry.js";

// counts framerate
export class FrameCounter {
    #historyLength;
    #history = new Array();
    #lastUpdateAt = performance.now();
    #fps = 0;
    constructor (historyLength = 10) {
        this.length = historyLength;
    }

    update () {
        const history = this.#history;
        const now = performance.now();
        const delta = (now - this.lastUpdateAt) / 1000;
        this.#lastUpdateAt = now;
        history.push(1 / delta);
        if (history.length > this.length) history.shift();
        this.#fps = Math.round(history.reduce((a, b) => a + b) / this.length);
    }

    get lastUpdateAt () { return this.#lastUpdateAt }
    get fps () { return this.#fps }
    get length () { return this.#historyLength }
    set length (number) { return (this.#historyLength = number) }
}

// everything this is in milliseconds
export class Interval {
    #interval;
    #lastInterval = performance.now();
    #lastDelta = performance.now();
    // milliseconds
    constructor (interval) { this.#interval = interval }

    #delta (time) { return time - this.#lastInterval }

    freeze () { this.#lastInterval = performance.now() - this.interval }

    get interval () { return this.#interval }
    get delta () { return performance.now() - this.#lastInterval }
    get lastDelta () { return this.#lastDelta } // delta value just before ready was called
    // check and set
    get ready () {
        const now = performance.now();
        const delta = this.#delta(now);
        if (delta >= this.#interval) { // access directly for speed
            this.#lastInterval = now;
            this.#lastDelta = delta;
            return true;
        }
        return false;
    }
}

export class AppCanvas {
    #sizeHash;
    #bbox;
    #cursor;
    #resizeObserver;
    #size;
    #resizeCallbacks = new Set();
    #center; // [!] does not update with size
    constructor (canvas, size = new Vector(1920, 1080)) {
        this.#size = size;
        this.#center = size.div(2);
        this.canvas = canvas;
        [this.canvas.width, this.canvas.height] = this.#size;
        this.#resizeObserver = new ResizeObserver(() => this.#onResize());
        this.#computeLayout();
        this.#cursor = Canvas2DContextCursorFactory(this.canvas);
    }

    #onResize () {
        this.#computeLayout();
        for (const callback of this.#resizeCallbacks)
            callback?.(this);
    }
    #computeLayout () {
        this.#size.apply(this.canvas.width, this.canvas.height);
        this.#center = this.size.div(2);
        console.log(this);
    }

    getBoundingBox () {
        const { hash } = this.size;
        if (hash === this.#sizeHash) return this.#bbox;
        this.#sizeHash = hash;
        this.#bbox = new BoundingBox(undefined, this.size);
        return this.#bbox;
    }
    removeResizeListener (handler) {
        this.#resizeCallbacks.delete(handler);
    }
    addResizeListener (handler) {
        this.#resizeCallbacks.add(handler);
    }

    get cursor () { return this.#cursor }
    get size () { return this.#size }
    get center () { return this.#center }
}

// Transforms world coorindates to canvas drawing coordinates. May be redundant / excessive
// Also accepts Vectors in place of x, y arguments for methods it overloads
class Canvas2DContextCursor {
    #ctx
    #size
    constructor(canvasContext) {
        this.#ctx = canvasContext;
        this.#size = new Vector(this.#ctx.canvas.width, this.#ctx.canvas.height);
    }

    normalizeY (y) {
        return this.#size.y - y;
    }
    screenshot (promise = true) {
        if (promise) { // this is more efficient than synchronous method
            return createImageBitmap(this.#ctx.canvas);
        } else {
            const offscreen = new OffscreenCanvas(...this.#size);
            const ctx = offscreen.getContext("2d");
            ctx.drawImage(this.#ctx.canvas, 0, 0);
            return offscreen.transferToImageBitmap(); 
        }
    }
    clear () {
        this.#ctx.clearRect(0, 0, this.#size.x, this.#size.y);
    }
    translate (x, y = null) {
        x?.isVector
            ? this.#ctx.translate(x.x, this.normalizeY(x.y))
            : this.#ctx.translate(x, this.normalizeY(y));
    }
    moveTo (x, y = null) {
        x?.isVector
            ? this.#ctx.moveTo(x.x, this.normalizeY(x.y))
            : this.#ctx.moveTo(x, this.normalizeY(y));
    }
    lineTo (x, y = null) {
        x?.isVector
            ? this.#ctx.lineTo(x.x, this.normalizeY(x.y))
            : this.#ctx.lineTo(x, this.normalizeY(y));
    }
    fillRect (x, y, ...args) {
        x?.isVector
            ? this.#ctx.fillRect(x.x, this.normalizeY(x.y), y, ...args)
            : this.#ctx.fillRect(x, this.normalizeY(y), ...args);
    }
    arc (x, y = null, ...args) {
        x?.isVector
            ? (y === null)
                ? this.#ctx.arc(x.x, this.normalizeY(x.y), ...args)
                : this.#ctx.arc(x.x, this.normalizeY(x.y), y, ...args)
            : this.#ctx.arc(x, this.normalizeY(y), ...args);
    }
    ellipse (x, y, ...args) {
        x?.isVector
            ? this.#ctx.ellipse(x.x, this.normalizeY(x.y), y, ...args)
            : this.#ctx.ellipse(x, this.normalizeY(y), ...args);
    }
    strokeText (text, x, y = null, ...args) {
        x?.isVector
            ? (y === null)
                ? this.#ctx.strokeText(text, x.x, this.normalizeY(x.y), ...args)
                : this.#ctx.strokeText(text, x.x, this.normalizeY(x.y), y, ...args)
            : this.#ctx.strokeText(text, x, this.normalizeY(y), ...args);
    }
    fillText (text, x, y = null, ...args) {
        x?.isVector
            ? (y === null)
                ? this.#ctx.fillText(text, x.x, this.normalizeY(x.y), ...args)
                : this.#ctx.fillText(text, x.x, this.normalizeY(x.y), y, ...args)
            : this.#ctx.fillText(text, x, this.normalizeY(y), ...args);
    }
    drawImage (image, ...args) { // only override / normalize Y when given vector parameters
        if (args.length === 1 && args[0]?.isVector) { // drawImage(image, dVector)
            const [dXY] = args;
            this.#ctx.drawImage(image, dXY.x, this.normalizeY(dXY.y));
        } else if (args.length === 2 && args[0]?.isVector && args[1]?.isVector) { // drawImage(image, Vector<dx, dy>, Vector<dWidth, dHeight>)
            const [dXY, dWH] = args;
            this.#ctx.drawImage(image, dXY.x, this.normalizeY(dXY.y), dWH.x, dWH.y);
        } else if (args.length === 4 && args[0]?.isVector && args[1]?.isVector && args[2]?.isVector && args[3]?.isVector) { // drawImage(image, Vector<sx, sy>, Vector<sWidth, sHeight>, Vector<dx, dy>, Vector<dWidth, dHeight>)
            const [sXY, sWH, dXY, dWH] = args;
            this.#ctx.drawImage(image, sXY.x, sXY.y, sWH.x, sWH.y, dXY.x, this.normalizeY(dXY.y), dWH.x, dWH.y);
        } else {
            this.#ctx.drawImage(image, ...args);
        }
    }
    get ctx () {
        return this.#ctx;
    }
    get isCanvasCursor () {
        return true;
    }
    get hash () {
        // pixels should be a Uint8ClampedArray
        const pixels = this.#ctx.getImageData(0, 0, this.#size.x, this.#size.y)?.data;
        let hash = 0;
        for (const val of pixels)
            hash = (hash * 31 + val) | 0; // 32-bit range
        return hash >>> 0;
    }
}

// DefaultDict implementation
export function Canvas2DContextCursorFactory (canvas) {
    const cursor = new Canvas2DContextCursor(canvas.getContext("2d"));
    return new Proxy(cursor, {
        get (target, prop, receiver) {
            const obj = (prop in target) ? target : target.ctx;
            const value = Reflect.get(obj, prop, obj);
            if (typeof value === "function")
                return value.bind(obj);
            return value;
        },
        set (target, prop, value, receiver) {
            return (prop in target)
                ? Reflect.set(target, prop, value, receiver)
                : Reflect.set(target.ctx, prop, value, target.ctx);
        }
    });
}
