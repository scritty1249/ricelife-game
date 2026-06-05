import { Vector } from "../geometry/geometry.js";
import { WorkerManager } from "./workers.js";
import { uuid } from "../utils/utils.js";

export class AppCanvas {
    #worker;
    #cursor;
    #size;
    constructor (canvas, size = new Vector(1920, 1080)) {
        this.#size = size;
        this.canvas = canvas;
        [this.canvas.width, this.canvas.height] = this.#size;
        this.#worker = new WorkerManager("./scripts/workers/canvas-worker.js");
        this.#cursor = Canvas2DContextCursorFactory(this.canvas);
    }

    async drawTerrain (key, terrain, fillColor, edgeColor, gradientWidth = 150, resolution = 1) {
        const { path, holes, buffers } = terrain.Float64(1);
        return this.worker.post("DRAW_TERRAIN", {
                    key: key,
                    polygon: {path, holes},
                    edgeColor: edgeColor.toString(),
                    fillColor: fillColor.toString(),
                    gradientWidth: gradientWidth,
                    resolution: resolution
                },
                buffers,
                key,
                ["image"]
            );
    }

    async copyCanvas (key, image) { // duplicates image data
        return this.worker.post("CLEAR_CANVAS", {key: key})
            .then(() => this.worker.post("DRAW_IMAGE",
                {key: key, image: image, x: 0, y: 0},
                image.buffer, // [!] don't include image in transfer list- copies the data
                key,
                ["image"]
            ));
    }

    async createCache (key) { return this.worker.post("INIT_CANVAS", {width: this.canvas.width, height: this.canvas.height, key: key}) }
    async destroyCache (key) { return this.worker.post("DROP_CANVAS", {key: key}) }
    get worker () { return this.#worker }
    get cursor () { return this.#cursor }
    get size () { return this.#size }
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

    #normalizeY(y) {
        return this.#size.y - y;
    }
    clear() {
        this.#ctx.clearRect(0, 0, this.#size.x, this.#size.y);
    }
    translate(x, y = null) {
        x?.isVector
            ? this.#ctx.translate(x.x, this.#normalizeY(x.y))
            : this.#ctx.translate(x, this.#normalizeY(y));
    }
    moveTo(x, y = null) {
        x?.isVector
            ? this.#ctx.moveTo(x.x, this.#normalizeY(x.y))
            : this.#ctx.moveTo(x, this.#normalizeY(y));
    }
    lineTo(x, y = null) {
        x?.isVector
            ? this.#ctx.lineTo(x.x, this.#normalizeY(x.y))
            : this.#ctx.lineTo(x, this.#normalizeY(y));
    }
    arc(x, y = null, ...args) {
        x?.isVector
            ? (y === null)
                ? this.#ctx.arc(x.x, this.#normalizeY(x.y), ...args)
                : this.#ctx.arc(x.x, this.#normalizeY(x.y), y, ...args)
            : this.#ctx.arc(x, this.#normalizeY(y), ...args);
    }
    strokeText(text, x, y = null, ...args) {
        x?.isVector
            ? (y === null)
                ? this.#ctx.strokeText(text, x.x, this.#normalizeY(x.y), ...args)
                : this.#ctx.strokeText(text, x.x, this.#normalizeY(x.y), y, ...args)
            : this.#ctx.strokeText(text, x, this.#normalizeY(y), ...args);
    }
    fillText(text, x, y = null, ...args) {
        x?.isVector
            ? (y === null)
                ? this.#ctx.fillText(text, x.x, this.#normalizeY(x.y), ...args)
                : this.#ctx.fillText(text, x.x, this.#normalizeY(x.y), y, ...args)
            : this.#ctx.fillText(text, x, this.#normalizeY(y), ...args);
    }
    get ctx() {
        return this.#ctx;
    }
    get isCanvasCursor() {
        return true;
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
