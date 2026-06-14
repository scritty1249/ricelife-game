import { Polygon } from "../geometry/geometry.js";
import { uuid } from "../utils/utils.js";

export class WorkerController {
    #pool;
    constructor (workerPool) {
        this.#pool = workerPool;
    }

    // Optimized versions of public methods, used for substeps in specific operations
    async #cutPolygon (depth, subject, dest, cuts) {
        const payload = { callback: false, cache: dest, cuts: [], subject};
        const transfer = [];
        for (const cut of cuts) {
            const data = cut.Float64(depth);
            payload.cuts.push(data);
            transfer.push(...data.buffers);
        }
        await this.#pool.post("CUTPOLY", payload, transfer, [subject, dest]);
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
        return;
    }
    async cutPolygon (depth, subjectid, destid, ...cuts) {
        if (cuts.length === 0) {
            return await this.#pool.pullCache(subjectid, false);
        } else {
            const payload = { callback: true, subject: subjectid, cache: destid, cuts: []};
            const transfer = [];
            for (const cut of cuts) {
                const data = cut.Float64(depth);
                payload.cuts.push(data);
                transfer.push(...data.buffers);
            }
            const data = await this.#pool.post("CUTPOLY", payload, transfer, [subjectid, destid]);
            return Polygon.fromObject(data.polygon, depth);
        }
    }
    async copyCanvas (cache, image) { // duplicates image data
        const transfer = image instanceof ImageBitmap ? [image] : [];
        await this.#pool.post(
            "DRAWIMG",
            {
                cache,
                subject: image,
                x: 0,
                y: 0,
                callback: false
            },
            transfer, 
            [cache]
        );
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
    async drawBlastedTerrains (depth, polygonid, canvasSize, terrainConfig, ...blasts) {
        // cuts blasts, and returns a Promise<Array> of image data, for each state of the terrain after the blasts (in order)
        // blast structure: { shape: Polygon, delay: Number (milliseconds) }
        const allCuts = blasts.toSorted((a, b) => a.delay - b.delay).map(({shape}) => shape);
        const frameJobs = [];
        const polygonJobs = [];
        const polygonKeys = Array.from(allCuts, (_, i) => {
            const key = `${polygonid}_p${i}_${uuid()}`
            return this.#pool.initCache("POLY", [[], [], 1], key)
                .then(() => key);
        });
        polygonKeys.unshift(Promise.resolve(polygonid));
        const canvasKeys = Array.from(allCuts, (_, i) => {
            const key = `${polygonid}_c${i}_${uuid()}`
            return this.#pool.initCache("CANVAS", [canvasSize.x, canvasSize.y], key)
                .then(() => key);
        });
        const jobs = [];
        let drawJob = Promise.resolve();
        let cutJob = Promise.resolve();
        // do cut operations, and seperate the caches into different workers (load balancing)
        for (let i = 0; i < allCuts.length; i++) {
            const cuts = allCuts.slice(0, i+1);
            const prevPolyKey = await polygonKeys[i];
            const polyKey = await polygonKeys[i+1];
            const canvasKey = await canvasKeys[i];
            const cj = cutJob
                .then(() => this.#cutPolygon(depth, prevPolyKey, polyKey, cuts))
                //.then(() => { if (i >= 1) this.#pool.dropCache(subKeys[i]) });
            const dj = cj
                // pool should assign the worker we want
                .then(() => this.drawTerrain(canvasKey, polyKey, terrainConfig.fill, terrainConfig.edge));
            polygonJobs.push(cj
                .then(() => this.#pool.pullCache(polyKey, false, false))
                .then(() => this.#pool.cache[polyKey]));
            frameJobs.push(dj
                .then(() => this.#pool.pullCache(canvasKey, true, false))
                .then(() => this.#pool.cache[canvasKey]));
            cutJob = cj;
            drawJob = dj;
        }
        const polygons = await Promise.all(polygonJobs);
        const frames = await Promise.all(frameJobs);
        const finalKey = await polygonKeys.at(-1);
        await this.#pool.copyCache(finalKey, polygonid, true, false);
        return { polygons, frames };
    }
    async createCache (id, type, ...args) { return await this.#pool.initCache(type, args, id) }
    async insertCache (id, type, payload) { return await this.#pool.pushCache(type, payload, id) }
    async updateCache (id, transfer = false) { await this.#pool.pullCache(id, transfer, true) }
    async destroyCache (id) { return await this.#pool.dropCache(id) }

    get cache() { return this.#pool.cache }
}
