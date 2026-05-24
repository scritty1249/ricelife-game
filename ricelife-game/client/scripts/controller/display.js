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

    drawTerrain (key, terrain, fillColor, edgeColor, gradientWidth = 150, resolution = 1) {
        const path = terrain.path.Float64Array;
        const holes = terrain.holes.map((hole) => hole.path.Float64Array);
        const holeBuffers = holes.map((arr) => arr.buffer);
        return this.worker.post("DRAW_TERRAIN", {
                    key: key,
                    path: path,
                    holes: holes,
                    edgeColor: edgeColor.toString(),
                    fillColor: fillColor.toString(),
                    gradientWidth: gradientWidth,
                    resolution: resolution
                },
                [path.buffer, ...holeBuffers],
                key,
                ["image"]
            );
    }

    async copyCanvas (key, image) { // duplicates image data
        return this.worker.post("CLEAR_CANVAS", {key: key})
            .then(() => this.worker.post("DRAW_IMAGE",
                {key: key, image: image, x: 0, y: 0},
                [], // [!] don't include image in transfer list- copies the data
                key,
                ["image"]
            ));
    }

    createCache (key) {
        const { width, height } = this.canvas;
        this.worker.post("INIT_CANVAS", {width: this.canvas.width, height: this.canvas.height, key: key});
    }

    destroyCache (key) { this.worker.post("DROP_CANVAS", {key: key}) }
    get worker () { return this.#worker }
}

export function wipeCanvas () {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
}
