import { Polygon, Vector, Terrain, Blast, generateUUID, equals, sortBlastIntervals } from "../core/Core.js";
import { Cache, CanvasCache } from "./pool/Core.js";
export class PoolManager {
    #pool;
    constructor (workerPool) {
        this.#pool = workerPool;
    }

    async drawTerrain (canvasID, terrainID) {
        await this.#pool.post(
            "DRAWTERRAIN", 
            {
                canvas: canvasID,
                terrain: terrainID
            },
            [],
            [cache, polygonid]
        );
        return;
    }
    // colliders are expected to all be Polygons or Cache IDs
    async traceAmmo (ammo, increment, limit, colliders) {
        const type = ammo.constructor.name;
        const { origin, velocity, acceleration, angle, resolution, power } = ammo;
        const encodedColliders = colliders.map((collider) =>
            collider?.isPolygon ? collider.Float32(collider.depth) : collider);
        const buffers = encodedColliders
                .filter((c) => typeof c !== "string")
                ?.map?.(({buffers}) => buffers)
                ?.flat?.(1) || [];
        const caches = encodedColliders.filter((c) => typeof c === "string");
        const payload = {
            increment, limit,
            ammo: type,
            params: ammo.decode(),
            collisions: encodedColliders
        };
        const landing = await this.#pool.post(
            "TRACEAMMO",
            payload,
            buffers,
            caches
        );
        // encode data
        if (landing) {
            if (landing.blasts?.length)
                landing.blasts = landing.blasts.map((blast) =>
                    Blast.fromObject(blast));
        }
        return landing;
    }
    // cuts are expected to all be Polygons or Cache IDs
    async cutTerrain (terrainID, cuts = [], pullCache = true, destID = undefined) {
        const dest = destID || terrainID;
        const encodedCuts = cuts.map((collider) =>
            collider?.isPolygon ? collider.Float32(collider.depth) : collider);
        const buffers = encodedCuts
                .filter((cut) => typeof cut !== "string")
                ?.map?.(({buffers}) => buffers)
                ?.flat?.(1) || [];
        const caches = encodedCuts
            .filter((cut) => typeof cut === "string")
            .push(terrainID);
        if (dest !== terrainID) caches.push(dest);
        const payload = { dest, source: terrainID, cuts: encodedCuts, callback: pullCache }
        const data = await this.#pool.post("CUTTERRAIN", payload, buffers, caches);
        return !pullCache || Terrain.fromObject(data.terrain);
    }
    async renderBlastIntervals (terrainID, planeSize, ...blasts) {
        // cuts blasts, and returns a Promise<Array> of image data, for each state of the terrain after the blasts (in order)
        // blast structure: { shape: Polygon, delay: Number (milliseconds) }
        if (blasts.length === 0) {
            const poly = this.#pool.pullCache(terrainID, false, false)
                .then(() => this.#pool.cache[terrainID]);
            return [{
                delay: 0,
                frame: undefined,
                blasts: [],
                polygon: await poly
            }];
        } else if (blasts.length === 1) {
            const poly = this.cutPolygon(terrainID, [blasts[0].shape.Polygon(1)]);
            const canvasID = `${terrainID}_c0_${uuid()}`;
            const canvasJob = this.#pool.createCache(new CanvasCache(planeSize.x, planeSize.y, canvasID));
            const frame = poly
                .then(() => canvasJob)
                .then(() => this.drawTerrain(canvasID, terrainID))
                .then(() => this.#pool.pullCache(canvasID, true, false))
                .then(() => this.#pool.cache[canvasID]);
            const delay = blasts[0].delay || 0;
            return [{
                delay,
                frame: await frame,
                blasts: blasts,
                polygon: await poly
            }];
        } else {
            // group blasts that occur at the same time, draw these onto the same canvas
            const blastIntervals = sortBlastIntervals(blasts);
            // promises
            const cutJobs = [];
            const drawJobs = [];
            // temporary cache IDs
            const jobID = generateUUID();
            const terrainIDs = [terrainID];
            blastIntervals.forEach((_, i) => terrainIDs.push(`${terrainID}_p${i}_${jobID}`));
            const canvasIDs = Array.from(blastIntervals, (_, i) => {
                const canvasID = `${terrainID}_c${i}_${jobID}`;
                const cache = new CanvasCache(planeSize.x, planeSize.y, canvasID);
                return this.#pool.createCache(cache)
                    .then(() => canvasID);
            });
            // setup promise chains
            let drawJob = Promise.resolve();
            let cutJob = Promise.resolve();
            // load balanced cut operations
            for (let i = 0; i < blastIntervals.length; i++) {
                const interval = blastIntervals[i];
                const cuts = interval.map(({shape}) => shape.Polygon(1));
                const prevTerrainID = terrainIDs[i];
                const currTerrainID = terrainIDs[i+1];
                const currCanvasID = await canvasIDs[i];
                const cj = cutJob
                    .then(() => this.cutTerrain(prevTerrainID, cuts, false, currTerrainID));
                const dj = cj
                    // pool should assign the worker we want
                    .then(() => this.drawTerrain(currCanvasID, currTerrainID));
                drawJobs.push(dj
                    .then(() => this.#pool.pullCache(currCanvasID, false))
                    .then(() => this.#pool.cache[currCanvasID]));
                cutJobs.push(cj
                    .then(() => this.#pool.pullCache(currTerrainID, true))
                    .then(() => this.#pool.cache[currTerrainID]));
                cutJob = dj;
                drawJob = dj;
                if (i-1 > 0)
                    cutJobs.at(-1).then(() =>
                        this.destroyCache(terrainIDs[i-1]));
            }
            // wait for all jobs to finish
            const frames = await Promise.all(drawJobs);
            const terrains = await Promise.all(cutJobs);
            // apply final cut polygon to original cache
            await this.#pool.copyCache(await terrainIDs.at(-1), terrainID, false);
            // package object into easier to parse structure
            return Array.from(blastIntervals, (interval, i) => ({
                blasts: interval,
                delay: interval[0].delay,
                frame: frames[i],
                terrain: terrains[i]
            }));
        }
    }
    async setCache (cache) { return await this.#pool.setCache(cache) }
    async fillCache (id, data) { return await this.#pool.fillCache(id, data) }
    async updateCache (id, clone = false) { await this.#pool.pullCache(id, clone) }
    async destroyCache (id) { return await this.#pool.dropCache(id) }
    async hashCache (id) { return await this.#pool.hashCache(id) }
    terminate () { this.#pool.terminate() }

    get cache () { return this.#pool.cache }
    get onload () { return this.#pool.onload }
}
