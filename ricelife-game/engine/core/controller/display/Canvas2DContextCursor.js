import { Vector } from "../../math/Vector.js";

const Canvas2DContextCursorHandler = {
    get (target, prop, receiver) {
        const obj = (prop in target) ? target : target.ctx;
        const value = Reflect.get(obj, prop, obj);
        if (typeof value === "function")
            return value.bind(obj);
        return value;
    },
    set (target, prop, value, receiver) {
        return (prop in target)
            ? Reflect.set(target, prop, value)
            : Reflect.set(target.ctx, prop, value, target.ctx);
    }
};

// Transforms world coorindates to canvas drawing coordinates. May be redundant / excessive
// Also accepts Vectors in place of x, y arguments for methods it overloads
class Canvas2DContextCursorProto {
    #ctx;
    #size = new Vector();
    #states = new Array();
    // when true, coordinates drawing will be interpreted relative to the canvas, instead of plane size
    // if plane size is not defined or set to (0, 0), fixed is always true.
    #isFixed = false;
    constructor(canvasContext, planeSize = undefined) {
        this.#ctx = canvasContext;
        if (planeSize) this.#size.apply(planeSize); // should only be positive values anyways
    }

    normalizeY (y) {
        return this.fixed
            ? this.#ctx.canvas.height - y
            : this.#size.y - y;
    }
    save () {
        const state = {
            fixed: this.#isFixed,
        };
        this.#states.push(state);
        this.#ctx.save();
    }
    restore () { 
        const state = this.#states.pop();
        if (state) {
            this.#isFixed = state.fixed;
        }
        this.#ctx.restore();
    }
    screenshot (promise = true) {
        if (promise) { // this is more efficient than synchronous method
            return createImageBitmap(this.#ctx.canvas);
        } else {
            const offscreen = new OffscreenCanvas(this.#ctx.canvas.width, this.#ctx.canvas.height);
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
    get planeSize () { return this.#size }
    get fixed () { return this.#isFixed || !this.#hasPlaneSize }
    set fixed (bool) { return (this.#isFixed = bool) || !this.#hasPlaneSize }
    get #hasPlaneSize () { return this.#size.lengthSquared > 0 }
}

// DefaultDict implementation
export class Canvas2DContextCursor {
    constructor (canvas, size, viewboxFn = undefined) {
        const cursor = new Canvas2DContextCursorProto(canvas.getContext("2d"), size, viewboxFn);
        return new Proxy(cursor, Canvas2DContextCursorHandler);
    }
}
