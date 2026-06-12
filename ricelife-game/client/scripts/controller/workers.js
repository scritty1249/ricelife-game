import { Polygon } from "../geometry/geometry.js";

export class WorkerController {
    #pool;
    constructor (workerPool) {
        this.#pool = workerPool;
    }

    async drawTerrain (cache, terrain, fillColor, edgeColor, gradientWidth = 150, resolution = 1) {
        const { path, holes, depth, buffers } = terrain.Float64(1);
        await this.#pool.post(
            "DRAWTERRAIN", 
            {
                canvas: cache,
                polygon: { path, holes, depth },
                edgeColor: edgeColor.toString(),
                fillColor: fillColor.toString(),
                gradientWidth: gradientWidth,
                resolution: resolution
            },
            buffers,
            [cache]
        );
        return await this.#pool.pullCache(cache, true);
    }
    async cutPolygon (depth, subject, ...cuts) {
        if (cuts.length === 0) return subject;
        if (!subject.isPolygon || cuts.some((cut) => !cut.isPolygon)) throw new Error(`[${this.constructor.name}]: non-Polygon passed to Polygon-only operation`);
        const payload = { callback: true, subject: subject.Float64(depth), cuts: []};
        const transfer = payload.subject.buffers;
        for (const cut of cuts) {
            const data = cut.Float64(depth);
            payload.cuts.push(data);
            transfer.push(...data.buffers);
        }
        // don't bother caching
        const data = await this.#pool.post("CUTPOLY", payload, transfer);
        return Polygon.fromObject(data.polygon, depth);
    }
    async copyCanvas (cache, image) { // duplicates image data
        const transfer = image instanceof ImageBitmap ? [image] : [];
        await this.#pool.post(
            "DRAWIMG",
            {
                subject: image,
                target: cache,
                x: 0,
                y: 0,
                callback: false
            },
            transfer, 
            [cache]
        );
        return await this.#pool.pullCache(cache, true);
    }
    async createCache (id, type, ...args) { return await this.#pool.initCache(type, args, id) }
    async destroyCache (id) { return await this.#pool.dropCache(id) }

    get cache() { return this.#pool.cache }
}
