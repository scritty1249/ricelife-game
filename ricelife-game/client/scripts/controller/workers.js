import { Polygon } from "../geometry/geometry.js";

export class WorkerController {
    #pool;
    constructor (workerPool) {
        this.#pool = workerPool;
    }

    async drawTerrain (cache, polygonid, fillColor, edgeColor, gradientWidth = 150, resolution = 1) {
        await this.#pool.post(
            "DRAWTERRAIN", 
            {
                canvas: cache,
                polygon: polygonid,
                edgeColor: edgeColor.toString(),
                fillColor: fillColor.toString(),
                gradientWidth: gradientWidth,
                resolution: resolution
            },
            [],
            [cache, polygonid]
        );
        return await this.#pool.pullCache(cache, true);
    }
    async cutPolygon (depth, subjectid, destid, ...cuts) {
        let data;
        if (cuts.length === 0) {
            data = await this.#pool.pullCache(subjectid, false);
        } else {
            const payload = { callback: true, subject: subjectid, cache: destid, cuts: []};
            const transfer = [];
            for (const cut of cuts) {
                const data = cut.Float64(depth);
                payload.cuts.push(data);
                transfer.push(...data.buffers);
            }
            data = await this.#pool.post("CUTPOLY", payload, transfer, [subjectid]);
        }
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
    async traceProjectile (polygonid, projectile, increment, limit) {
        const { origin, velocity, acceleration, drag, shape } = projectile;
        const payload = {
            origin, velocity, acceleration, drag, increment, limit,
            target: polygonid
        };
        const transfer = [];
        let type = "INTERSECTPROJ";
        if (shape.isCircle) {
            payload.radius = shape.radius;
            payload.resolution = shape.resolution;
            type = "INTERSECTCIRCLEPROJ";
        } else {
            payload.hitbox = shape.Float64(1);
            transfer.push(...payload.hitbox.buffers);
        }
        return await this.#pool.post(type, payload, transfer, [polygonid]);
    }
    async createCache (id, type, ...args) { return await this.#pool.initCache(type, args, id) }
    async updateCache (id, type, payload) { return await this.#pool.pushCache(type, payload, id) }
    async destroyCache (id) { return await this.#pool.dropCache(id) }

    get cache() { return this.#pool.cache }
}
