import { Vector } from "../geometry/vector.js";

export default class AppCanvas {
    #cache;
    constructor (canvas, size = new Vector(1920, 1080)) {
        this.size = size;
        this.#cache = {};
        this.canvas = canvas;
        [this.canvas.width, this.canvas.height] = this.size;
        this.ctx = this.canvas.getContext("2d");
        this.clear = wipeCanvas;
    }

    createCache (id) {
        if (Object.hasOwn(this.#cache, id))
            throw new Error(`[AppCanvas] Error: Cannot create cache with id "${id}" - one already exists`);
        this.#cache[id] = this.#initCanvas(id, true);
        this.canvas.before(this.#cache[id].canvas);
    }

    destroyCache (id) {
        if (!Object.hasOwn(this.#cache, id))
            throw new Error(`[AppCanvas] Error: Cannot destroy cache with id "${id}" - does not exist`);
        this.#cache[id].remove();
        delete this.#cache[id];
    }

    #initCanvas (id = undefined, cache = true) {
        const canvas = document.createElement("canvas");
        if (id !== undefined)
            canvas.id = id
        if (cache)
            canvas.classList.add("cache");
        canvas.width = this.size.x;
        canvas.height = this.size.y;
        const ctx = canvas.getContext("2d");
        return { canvas: canvas, ctx: ctx, clear: wipeCanvas };
    }

    get cache () { return this.#cache }
}

function wipeCanvas () {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
}
