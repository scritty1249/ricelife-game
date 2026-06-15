import { Polygon, Vector } from "../geometry/geometry.js";
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
        await this.#pool.post("CUTPOLY", payload, transfer, [subject]);
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
        const shot = projectile.constructor.name;
        const { origin, velocity, acceleration, angle, resolution, power } = projectile;
        const payload = {
            origin, angle, power, resolution, increment, limit, shot,
            collisions: [polygonid]
        };
        const landing = await this.#pool.post("INTERSECTPROJ", payload, [], [polygonid]);
        // encode data
        if (landing) {
            if (landing.blasts?.length)
                for (const blast of landing.blasts) {
                    blast.shape = Polygon.fromObject(blast.shape, blast.shape.depth);
                    blast.position = Vector.fromObject(blast.position);
                }
            if (landing.bounces?.length)
                for (let i = 0; i < landing.bounces.length; i++) {
                    landing.bounces[i].point = Vector.fromObject(landing.bounces[i].point);
                    landing.bounces[i].normal = Vector.fromObject(landing.bounces[i].normal);
                    landing.bounces[i].reflection = Vector.fromObject(landing.bounces[i].reflection);
                    landing.bounces[i].direction = Vector.fromObject(landing.bounces[i].direction);
                }
        }
        return landing;
    }
    async drawBlastedTerrains (depth, polygonid, canvasSize, terrainConfig, ...blasts) {
        // cuts blasts, and returns a Promise<Array> of image data, for each state of the terrain after the blasts (in order)
        // blast structure: { shape: Polygon, delay: Number (milliseconds) }
        if (blasts.length === 0) {
            const poly = this.#pool.pullCache(polygonid, false, false)
                .then(() => this.#pool.cache[polygonid]);
            const key = `${polygonid}_c0_${uuid()}`;
            const canvasKey = this.#pool.initCache("CANVAS", [canvasSize.x, canvasSize.y], key)
                    .then(() => key);
            await poly;
            const frame = await this.drawTerrain(await canvasKey, polygonid, terrainConfig.fill, terrainConfig.edge)
                .then(() => this.#pool.pullCache(canvasKey, true, false))
                .then(() => this.#pool.cache[canvasKey]);
            return {polygon: await poly, frames: [frame]};
        } else if (blasts.length === 1) {
            const poly = this.cutPolygon(depth, polygonid, polygonid, blasts[0].shape);
            const key = `${polygonid}_c0_${uuid()}`;
            const canvas = this.#pool.initCache("CANVAS", [canvasSize.x, canvasSize.y], key);
            await poly;
            await canvas;
            const frame = this.drawTerrain(key, polygonid, terrainConfig.fill, terrainConfig.edge)
                .then(() => this.#pool.pullCache(key, true, false))
                .then(() => this.#pool.cache[key]);
            return {polygon: await poly, frames: [await frame]};
        } else {
            const allCuts = blasts.toSorted((a, b) => a.delay - b.delay).map(({shape}) => shape);
            const frameJobs = [];
            const polygonJobs = [];
            const polygonKeys = Array.from(allCuts, (_, i) => `${polygonid}_p${i}_${uuid()}`);
            polygonKeys.unshift(polygonid);
            const canvasKeys = Array.from(allCuts, (_, i) => {
                const key = `${polygonid}_c${i}_${uuid()}`;
                return this.#pool.initCache("CANVAS", [canvasSize.x, canvasSize.y], key)
                    .then(() => key);
            });
            const jobs = [];
            let drawJob = Promise.resolve();
            let cutJob = Promise.resolve();
            let polyJob = Promise.resolve();
            // do cut operations, and seperate the caches into different workers (load balancing)
            for (let i = 0; i < allCuts.length; i++) {
                const cuts = allCuts.slice(0, i+1);
                const prevPolyKey = polygonKeys[i];
                const polyKey = polygonKeys[i+1];
                const canvasKey = await canvasKeys[i];
                const cj = cutJob
                    .then(() => this.#cutPolygon(depth, prevPolyKey, polyKey, cuts));
                const dj = cj
                    // pool should assign the worker we want
                    .then(() => this.drawTerrain(canvasKey, polyKey, terrainConfig.fill, terrainConfig.edge));
                frameJobs.push(dj
                    .then(() => this.#pool.pullCache(canvasKey, true, false))
                    .then(() => this.#pool.cache[canvasKey]));
                cutJob = dj;
                drawJob = dj;
                if (i === allCuts.length - 1)
                    polyJob = cj
                        .then(() => this.#pool.pullCache(polyKey, false, false))
                        .then(() => this.#pool.cache[polyKey]);
            }
            
            const polygon = await polyJob;
            const frames = await Promise.all(frameJobs);
            const finalKey = await polygonKeys.at(-1);
            await polyJob;
            await this.#pool.copyCache(finalKey, polygonid, true, false);
            return { polygon, frames };
        }
    }
    async createCache (id, type, ...args) { return await this.#pool.initCache(type, args, id) }
    async insertCache (id, type, payload) { return await this.#pool.pushCache(type, payload, id) }
    async updateCache (id, transfer = false) { await this.#pool.pullCache(id, transfer, true) }
    async destroyCache (id) { return await this.#pool.dropCache(id) }

    get cache() { return this.#pool.cache }
}
