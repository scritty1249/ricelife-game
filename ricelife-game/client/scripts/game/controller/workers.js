import { Polygon, Vector } from "../geometry/geometry.js";
import { Blast } from "../projectile/projectile.js";
import { uuid, floatEqual } from "../utils/utils.js";

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

    async drawTerrain (cache, polygonid, fillColor, edgeColor, gradientWidth = 75, resolution = 15) {
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
            const data = await this.#pool.post("CUTPOLY", payload, transfer, subjectid === destid ? [subjectid] : [subjectid, destid]);
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
    async traceProjectile (colliders, projectile, increment, limit) {
        const ammo = projectile.constructor.name;
        const { origin, velocity, acceleration, angle, resolution, power } = projectile;
        const collidersData = colliders.map((collider) =>
            collider?.isPolygon ? collider.Float64(collider.depth) : collider);
        const payload = {
            increment, limit, ammo,
            params: projectile.decode(),
            collisions: collidersData
        };
        const landing = await this.#pool.post(
            "TRACESHOT",
            payload,
            collidersData
                .filter((c) => typeof c !== "string")
                ?.map?.(({buffers}) => buffers)
                ?.flat?.(1) || [],
            collidersData
                .filter((c) => typeof c === "string"));
        // encode data
        if (landing) {
            if (landing.blasts?.length)
                landing.blasts = landing.blasts.map((blast) =>
                    Blast.fromObject(blast));
        }
        return landing;
    }
    async drawBlastedTerrains (depth, polygonid, planeSize, terrainConfig, ...blasts) {
        // cuts blasts, and returns a Promise<Array> of image data, for each state of the terrain after the blasts (in order)
        // blast structure: { shape: Polygon, delay: Number (milliseconds) }
        if (blasts.length === 0) {
            const poly = this.#pool.pullCache(polygonid, false, false)
                .then(() => this.#pool.cache[polygonid]);
            return [{
                delay: 0,
                frame: undefined,
                blasts: [],
                polygon: await poly
            }];
        } else if (blasts.length === 1) {
            const poly = this.cutPolygon(depth, polygonid, polygonid, blasts[0].shape.Polygon(1));
            const key = `${polygonid}_c0_${uuid()}`;
            const canvas = this.#pool.initCache("CANVAS", [planeSize.x, planeSize.y], key);
            const frame = poly
                .then(() => canvas)
                .then(() => this.drawTerrain(key, polygonid, terrainConfig.fill, terrainConfig.edge))
                .then(() => this.#pool.pullCache(key, true, false))
                .then(() => this.#pool.cache[key]);
            const delay = blasts[0].delay || 0;
            return [{
                delay,
                frame: await frame,
                blasts: blasts,
                polygon: await poly
            }];
        } else {
            // group blasts that occur at the same time, draw these onto the same canvas
            const uniq = [];
            const blastIntervals = Array.from(Map.groupBy(blasts, ({delay}) => {
                const value = uniq.find((key) => floatEqual(key, delay))
                if (value !== undefined) return value;
                uniq.push(delay);
                return delay;
            }).entries())
            .sort((a, b) => a[0] - b[0])
            .map(([_, blast]) => blast);
            // init promise arrays
            const polyJobs = [];
            const frameJobs = [];
            const polygonJobs = [];
            const intervalDelays = [];
            // generate temp cache ids and create needed caches
            const polygonKeys = Array.from(blastIntervals, (_, i) => `${polygonid}_p${i}_${uuid()}`);
            polygonKeys.unshift(polygonid);
            const canvasKeys = Array.from(blastIntervals, (_, i) => {
                const key = `${polygonid}_c${i}_${uuid()}`;
                return this.#pool.initCache("CANVAS", [planeSize.x, planeSize.y], key)
                    .then(() => key);
            });
            // setup promise chains
            let drawJob = Promise.resolve();
            let cutJob = Promise.resolve();
            // do cut operations, and seperate the caches into different workers (load balancing)
            for (let i = 0; i < blastIntervals.length; i++) {
                const interval = blastIntervals[i];
                const cuts = interval.map(({shape}) => shape.Polygon(1));
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
                polyJobs.push(cj
                    .then(() => this.#pool.pullCache(polyKey, false, true))
                    .then(() => this.#pool.cache[polyKey]));
                cutJob = dj;
                drawJob = dj;
                if (i-1 > 0)
                    polyJobs.at(-1)
                        .then(() =>
                            this.destroyCache(polygonKeys[i-1]));
            }
            
            // syncronize everything
            const frames = await Promise.all(frameJobs);
            const polygons = await Promise.all(polyJobs);
            const finalKey = await polygonKeys.at(-1);
            // apply final cut polygon to original cache
            await this.#pool.copyCache(finalKey, polygonid, true, false);
            // package object into easier to parse structure
            const intervals = [];
            for (let i = 0; i < blastIntervals.length; i++) {
                const interval = blastIntervals[i];
                const frame = frames[i];
                const polygon = polygons[i];
                intervals.push({
                    delay: interval[0].delay,
                    frame: frame,
                    blasts: interval,
                    polygon: polygon
                });
            }
            return intervals;
        }
    }
    async createCache (id, type, ...args) { return await this.#pool.initCache(type, args, id) }
    async insertCache (id, type, payload) { return await this.#pool.pushCache(type, payload, id) }
    async updateCache (id, transfer = false) { await this.#pool.pullCache(id, transfer, true) }
    async destroyCache (id) { return await this.#pool.dropCache(id) }
    async hashCache (id) { return await this.#pool.hashCache(id) }
    terminate () { this.#pool.terminate() }

    get cache() { return this.#pool.cache }
    get onload () { return this.#pool.onload }
}
