import { Vector } from "../geometry/geometry.js";
import { uuid } from "../utils.js";

export class AppCanvas { // [!] TODO: Implement WorkerManager here
    #worker;
    #cache;
    #cacheProxy;
    #workerMessagePool;
    constructor (canvas, size = new Vector(1920, 1080)) {
        this.size = size;
        this.canvas = canvas;
        [this.canvas.width, this.canvas.height] = this.size;
        this.ctx = this.canvas.getContext("2d");
        this.clear = wipeCanvas;
        this.#cache = {}; // storing the bitmaps from worker
        this.#worker = new Worker("./scripts/workers/canvas-worker.js", {type: "module"}); // path is relative to wherever this is being imported from browser POV- i.e. from index.html
        if (!this.#worker) throw new Error("[AppCanvas] Error: Failed to initalize canvas web worker - file could not be loaded");
        this.#workerMessagePool = {}; // [!] No automatic garbage collection on resolved transactions. Accessing functions need to delete this to prevent overflowing
        this.#worker.onmessage = (e) => {
            const { id, error } = e.data;
            if (this.#workerMessagePool[id]) {
                this.#workerMessagePool[id].isResolved = true;
                if (error) this.#workerMessagePool[id].reject(e.data);
                else this.#workerMessagePool[id].resolve(e.data);
            } else {
                console.warn("[AppCanvas] Warning: Canvas web worker replied to an unregistered transaction ", e);
            }
        }
        this.#cacheProxy = new Proxy(this.#cache, {
            set(target, prop, value, receiver) {
                if (target[prop]?.close) target[prop].close(); // cleanup memory
                return Reflect.set(target, prop, value, receiver);
            },
            deleteProperty(target, prop) {
                if (target[prop]?.close) target[prop].close(); // cleanup memory
                return Reflect.deleteProperty(target, prop);
            }
        });
    }

    drawTerrain (key, terrain, fillColor, edgeColor, gradientWidth = 150, resolution = 1) {
        const path = terrain.path.Float64Array;
        const holes = terrain.holes.map((hole) => hole.path.Float64Array);
        const holeBuffers = holes.map((arr) => arr.buffer);
        return this.#transaction("DRAW_TERRAIN", {
            key: key,
            path: path,
            holes: holes,
            edgeColor: edgeColor.toString(),
            fillColor: fillColor.toString(),
            gradientWidth: gradientWidth,
            resolution: resolution
        }, [path.buffer, ...holeBuffers]).then(({image}) => {this.cache[key] = image}); // [!] don't return bitmap - force usage to remain instead the managed ecosystem (Proxy trap closes the image when done)
    }

    copyCanvas (key, image) { // duplicates image data
        return this.#transaction("CLEAR_CANVAS", {key: key})
            .then(({id}) => this.deleteTransation(id))
            .then(() => this.#transaction("DRAW_IMAGE", {key: key, image: image, x: 0, y: 0})) // [!] don't include image in transfer list- copies the data
            .then(({image}) => {this.cache[key] = image});
    }

    createCache (key) {
        const { width, height } = this.canvas;
        this.#transaction("INIT_CANVAS", {width: width, height: height, key: key})
            .then(({id}) => this.deleteTransation(id));
    }

    destroyCache (key) {
        this.#transaction("DROP_CANVAS", {key: key})
            .then(({id}) => this.deleteTransation(id));
    }

    #transaction (type, payload, promise = true, transfer = []) {
        const id = uuid();
        this.#workerMessagePool[id] = Promise.withResolvers();
        this.#workerMessagePool[id].isResolved = false;
        // this.#workerMessagePool[id].close = () => this.deleteTransation(id);
        this.#worker.postMessage({
            type: type,
            payload: payload,
            id: id
        }, transfer);
        return promise ? this.#workerMessagePool[id].promise : id;
    }

    deleteTransation (id) { delete this.#workerMessagePool[id]; delete this.cache[id] }
    get cache () { return this.#cacheProxy }
}

export function wipeCanvas () {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
}
