import { Vector } from "../geometry/geometry.js";
import { WorkerManager } from "./workers.js";
import { uuid } from "../utils.js";

export class AppCanvas { // [!] TODO: Implement WorkerManager here
    #worker;
    constructor (canvas, size = new Vector(1920, 1080)) {
        this.size = size;
        this.canvas = canvas;
        [this.canvas.width, this.canvas.height] = this.size;
        this.ctx = this.canvas.getContext("2d");
        this.clear = wipeCanvas;
        this.#worker = new WorkerManager("./scripts/workers/canvas-worker.js");
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
}

export function wipeCanvas () {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
}
