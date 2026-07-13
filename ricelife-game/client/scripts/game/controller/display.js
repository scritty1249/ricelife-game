import { Vector, BoundingBox } from "../geometry/geometry.js";
import { floatEqual } from "../utils/utils.js";

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

// virtual coordinate space viewport window
class Viewbox extends BoundingBox {
    #canvas;
    constructor (appCanvas, size) {
        super(undefined, new Vector(1, 1));
        if (!appCanvas?.isAppCanvas) throw new Error(`[${this.constructor.name}]: canvas must be of type AppCanvas, got ${typeof appCanvas}`);
        this.#canvas = appCanvas;
        this.max.apply(appCanvas.planeSize);
        if (size) this.applySize(size);
    }

    getPosition () { return super.center }
    setPosition (point) {
        const { planeSize } = this.#canvas;
        const { size } = this;
        const targetMin = point.sub(size.div(2));
        const limit = planeSize.sub(size);
        const minX = Math.max(0, Math.min(targetMin.x, limit.x));
        const minY = Math.max(0, targetMin.y);
        this.max.apply(this.min.apply(minX, minY)).add(size, true);
        return this; // for chaining
    }
    applySize (size) {
        const scale = size.div(this.size);
        return this.applyScale(scale);
    }
    applyScale (scale) {
        const { planeSize } = this.#canvas;
        const offset = this.center.clone();
        const min = this.min.sub(offset, false).mul(scale, true).add(offset, true);
        const max = this.max.sub(offset, false).mul(scale, true).add(offset, true);
        const size = max.sub(min).abs(true);
        const aspect = size.quot();
        if (size.x > planeSize.x) size.apply(planeSize.x, planeSize.x / aspect);
        //if (size.y > planeSize.y) size.apply(planeSize.y * aspect, planeSize.y);
        if (this.size.eq(size)) return this;
        const limit = planeSize.sub(size);
        const minX = Math.max(0, Math.min(min.x, limit.x));
        const minY = Math.max(0, Math.min(min.y, limit.y));
        this.max.apply(this.min.apply(minX, minY)).add(size, true);
        return this; // for chaining
    }
    // sets cursor origin and scale to match viewbox
    setCursor (cursor, save = false) {
        if (save) cursor.save();
        cursor.scale(this.canvasScale);
        cursor.ctx.translate(-this.min.x, -cursor.normalizeY(this.max.y));
    }
    setCanvas (save = false) {
        this.setCursor(this.#canvas.cursor, save);
    }
    toRelative (point, mutate = false) {
        const pt = mutate ? point : point.clone();
        return pt.sub(this.min, true)
            .mul(this.canvasScale, true);
    }
    toGlobal (point, mutate = false) {
        const pt = mutate ? point : point.clone();
        return pt.div(this.canvasScale, true)
            .add(this.min, true);
    }

    get isViewbox () { return true }
    get canvasScale () { return this.#canvas.size.div(this.size) }
    get isOnEdge () {
        const { planeSize } = this.#canvas;
        return this.min.x <= 0
            || this.min.y <= 0
            || this.max.x >= planeSize.x
            || this.max.y >= planeSize.y;
    }
    get aspectRatio () { return this.size.quot() }
    // preserves height
    // [!] inefficient
    set aspectRatio (ratio) {
        this.applySize(new Vector(this.height * ratio, this.height));
        return ratio;
    }
}

export class AppCanvas {
    #cursor;
    #window;
    #ratio = 1;
    #Viewbox;
    #bbox = new BoundingBox();
    #size = new Vector();
    #resizeCallbacks = new Set();
    #center = new Vector();
    #planeSize = new Vector();
    // planeSize is the true size of the global coorindates
    constructor (canvas, window, planeSize) {
        this.canvas = canvas;
        this.planeSize.apply(planeSize);
        this.#Viewbox = new Viewbox(this);
        this.#window = window;
        this.window.addEventListener("resize", this.#onResize);
        this.#computeLayout();
        this.#cursor = Canvas2DContextCursorFactory(this.canvas, this.planeSize);
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
        this.#ratio = this.size.quot();
        this.Viewbox.aspectRatio = this.aspectRatio;
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
    get Viewbox () { return this.#Viewbox }
    get planeSize () { return this.#planeSize }
    get cursor () { return this.#cursor }
    get size () { return this.#size }
    get planeScale () { return this.size.div(this.planeSize) }
    get aspectRatio () { return this.#ratio }
    get center () { return this.#center }
    get window () { return this.#window }
}

// Transforms world coorindates to canvas drawing coordinates. May be redundant / excessive
// Also accepts Vectors in place of x, y arguments for methods it overloads
class Canvas2DContextCursor {
    #ctx;
    #size;
    #states = new Array();
    fixed = false;
    constructor(canvasContext, size) {
        this.#ctx = canvasContext;
        this.#size = size; // bind reference
    }

    normalizeY (y) {
        return this.fixed
            ? this.#ctx.canvas.height - y
            : this.#size.y - y;
    }
    save () {
        const state = {fixed: this.fixed};
        this.#states.push(state);
        this.#ctx.save();
    }
    restore () { 
        const state = this.#states.pop();
        if (state) {
            this.fixed = state.fixed;
        }
        this.#ctx.restore();
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
        this.#ctx.clearRect(0, 0, this.#ctx.canvas.width, this.#ctx.canvas.height);
    }
    translate (x, y = null) {
        x?.isVector
            ? this.#ctx.translate(x.x, -x.y)
            : this.#ctx.translate(x, -y);
    }
    scale (x, y = null) {
        x?.isVector
            ? this.#ctx.scale(x.x, x.y)
            : this.#ctx.scale(x, y);
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
    get filterSupported () { return "filter" in this.#ctx }
    get blurSupported () {
        this.#ctx.save();
        if (!this.filterSupported) return false;
        const testFilter = "blur(10px)";
        this.#ctx.filter = testFilter;
        const supported = this.#ctx.filter === testFilter;
        this.#ctx.restore();
        return supported;
    }
}

// DefaultDict implementation
export function Canvas2DContextCursorFactory (canvas, size, viewboxFn = undefined) {
    const cursor = new Canvas2DContextCursor(canvas.getContext("2d"), size, viewboxFn);
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
