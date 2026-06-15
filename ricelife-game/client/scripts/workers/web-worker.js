
import { Polygon, Color, Vector, Circle } from "../geometry/geometry.js";
import { drawTerrain } from "../terrain/terrain.js";
import { Shot } from "../projectile/projectile.js";
import { CACHE_TYPES } from "./types.js";
import * as ShotType from "../projectile/basic.js";

/* Polygon64: 
 * {
 *    path: Float64Array,
 *    holes: [...Polygon64]
 * }
 */

const _queryString = self.location.search;
const _urlParams = new URLSearchParams(_queryString);
const ID = _urlParams.get("id");
const LOG_LEVEL = _urlParams.get("logLevel");
const CACHE = {};
const CHANNELS = {};
const TRANSACTIONS = {};

function postSuccess (id) { postResponse(id) }

function postFailure (id, err) {
    self.postMessage({id, error: {
        message: err?.message,
        name: err?.name,
        stack: err?.stack?.split("\n")
    }});
}

function postResponse (id, payload = {}, transfer = []) {
    self.postMessage({id, payload: payload, state: currentState()}, transfer);
}

function currentState () {
    return {cache: Object.keys(CACHE)};
}

function initCache (id, type, args) { // create new
    if (type in CACHE_TYPES) {
        const TYPE = CACHE_TYPES[type];
        CACHE[id] = { type, data: TYPE.create(...args) };
        return true;
    }
    return false;
}

function createCache (id, type, payload, reference = false) { // create from payload
    if (type in CACHE_TYPES) {
        const TYPE = CACHE_TYPES[type];
        CACHE[id] = { type, data: reference ? TYPE.encodeReference(payload) : TYPE.encode(payload) };
        return true;
    }
    return false;
}

const onworkermessage = (e) => {
    const { command, id, payload } = e.data;
    const port = e.target;
    if (LOG_LEVEL >= 2) console.debug(`[WebWorker] (${ID}): Transaction ${id} receieved from peer\n\t${command}: `,  payload);
    if (command === "CACHE") {
        if (createCache(payload.cache, payload.type, payload.data)) {
            port.postMessage({command: "ACK", id});
            postSuccess("CACHEUPDATE_" + id);
        } else {
            const err = new Error(`[WebWorker]  (${ID}): Failed to create cache "${payload.cache}"`);
            postFailure("", err);
            TRANSACTIONS[id]?.reject(err);
        }
    } else if (command === "ACK") {
        TRANSACTIONS[id]?.resolve();
    }
}

self.onmessage = async (e) => {
    const {
        command, // only direct messages from pool manager have this set
        id, // transaction id

        // messages directly from pool manager may exclude these parameters
        type,
        payload
    } = e.data;
    try {
        if (LOG_LEVEL >= 2) console.debug(`[WebWorker] (${ID}): Transaction ${id} receieved from parent\n\t${command ? command : type}: `,  payload);
        if (command) {
            processManagerCommand(command, id, payload);
        } else if (type === "INTERSECTPROJ") {
            /* Payload expected:
             * {
             *    shot: String,
             *    collisions: [...Polygon64 | UUID],
             *    origin: Vector,
             *    angle: Number, (radians)
             *    power: Number,
             *    resolution: Number,
             *    increment: Number,
             *    limit: Number
             * }
             */
            const { shot, collisions, origin, angle, power, resolution, increment, limit } = payload;
            const targetPolys = collisions.map((target) =>
                typeof target === "string"
                    ? CACHE[target]?.data?.poly
                    : Polygon.fromObject(target, target.depth));
            const proj = new ShotType[shot](Vector.fromObject(origin), angle, power, resolution);
            const result = proj.intersectAt(targetPolys, increment, limit);
            if ("blasts" in result)
                for (const blast of result.blasts)
                    blast.shape = blast.shape.Float64(1);
            delete result.state;
            postResponse(id, result);
        } else if (type === "CUTPOLY") {
            /* Payload expected:
             * {
             *    callback: Boolean, (send it back, will leave a copy in worker memory)
             *    subject: Polygon64 | UUID,
             *    cuts: [ ...<Polygon64 | UUID> ],
             *    cache: UUID, (cache result, can be used to mutate original)
             * }
             */
            const { subject, cuts, callback, cache } = payload;
            const isUuid = typeof subject === "string";
            const depth = isUuid
                ? CACHE[subject]?.data?.depth
                : subject.depth;
            const polygon = isUuid
                ? (cache === subject)
                    ? CACHE[subject]?.data?.poly
                    : CACHE[subject]?.data?.poly?.clone(true)
                : Polygon.fromObject(subject, depth);
            for (const cut of cuts) {
                polygon.cut(
                    typeof cut === "string"
                        ? CACHE[cut]?.data?.poly
                        : Polygon.fromObject(cut, depth),
                    true
                );
            }
            if (subject !== cache) createCache(cache, "POLY", polygon);
            const result = {};
            let bufs = [];
            if (callback) {
                const { path, holes, buffers } = polygon.Float64(depth+1); // [!] We are not expecting our holes to have more goddamn holes, but ffs JUST IN CASE...
                result.polygon = {path, holes, depth: depth + 1};
                bufs = buffers;
            }
            postResponse(id, result, bufs);
        } else if (type === "DRAWTERRAIN") {
            /* Payload expected:
             * {
             *    canvas: UUID,
             *    polygon: Polygon64 | UUID,
             *    edgeColor: String,
             *    fillColor: String,
             *    gradientWidth: Number,
             *    resolution: Number
             * }
             */
            const { polygon, edgeColor, fillColor, gradientWidth, resolution } = payload;
            const { canvas, cursor } = CACHE[payload.canvas]?.data;
            const isUuid = typeof polygon === "string";
            const terrain = isUuid
                ? CACHE[polygon]?.data?.poly
                : Polygon.fromObject(polygon, polygon.depth);
            cursor.clear();
            drawTerrain(cursor, terrain, new Color(fillColor), new Color(edgeColor), gradientWidth, resolution);
            postSuccess(id);
        } else if (type === "DRAWIMG") {
            /* Payload expected:
             * {
             *    callback: Boolean,
             *    subject: Canvas | Bitmap | UUID,
             *    cache: UUID,
             *    x: Number,
             *    y: Number,
             *    width?: Number,
             *    height?: Number,
             *    duplicate?: Boolean (false) (keep a copy of the image cached when transferring the result back)
             * }
             */
            const { subject, cache, x, y, width, height, duplicate, callback = false } = payload;
            const from = typeof subject === "string"
                ? CACHE[subject]?.data?.canvas
                : subject;
            const { canvas, cursor } = CACHE[cache]?.data;
            if (width === undefined || height === undefined) cursor.drawImage(from, x, y);
            else cursor.drawImage(from, x, y, width, height);
            subject.close?.();
            if (callback) {
                let image;
                if (duplicate) {
                    image = await createImageBitmap(canvas);
                } else {
                    image = canvas.transferToImageBitmap();
                    delete CACHE[cache];
                }
                postResponse(id, {image}, [image]);
            } else postSuccess(id);
        } else if (type === "CLRCANVAS") {
            /* Payload expected:
             * {
             *    cache: UUID
             * }
             */
            const { cursor } = CACHE[payload.cache]?.data;
            cursor.clear();
            postSuccess(id);
        } else {
            postFailure(id, new Error("Unrecognized message type " + type));
        }
    } catch (e) {
        postFailure(id, e);
    }
};

// basic controls, may be redundant
async function processManagerCommand (command, id, payload) {
    // Pool manager command- these aren't error checked (no guard rails)
    try {
        if (command === "ADDWKR") {
           /* Payload expected:
            * {
            *    port: MessagePort,
            *    worker: UUID
            * }
            */
            const { port, worker } = payload;
            CHANNELS[worker] = port;
            CHANNELS[worker].onmessage = onworkermessage;
            CHANNELS[worker].start();
            postSuccess(id);
        } else if (command === "INITCACHE") {
           /* Payload expected:
            * {
            *   type: "POLY" | "CANVAS",
            *   cache: UUID.
            *   args: [...argv]
            * }
            */
            const { cache, type, args } = payload;
            if (initCache(cache, type, args)) postSuccess(id);
            else postFailure(id, new Error(`[WebWorker]  (${ID}): Failed to initalize ${type} cache "${cache}"`));
        } else if (command === "PUSHCACHE") {
           /* Payload expected:
            * {
            *   type: "POLY" | "CANVAS",
            *   cache: UUID.
            *   payload: {...kwargs}
            * }
            */
            const { cache, type, payload: dataPayload } = payload;
            if (createCache(cache, type, dataPayload)) postSuccess(id);
            else postFailure(id, new Error(`[WebWorker]  (${ID}): Failed to push to ${type} cache "${cache}"`));
        } else if (command === "SENDCACHE") { // [!] Canvas caches are transfer-only.
           /* Payload expected:
            * {
            *    manager: Boolean,
            *    cache: UUID,
            *    transfer: Boolean,
            *    newCache?: UUID, new cache id to store at. If undefined, will reuse original cache key
            *    worker?: UUID,
            *    preserveKey?: Boolean (false) when trasnferring payload, leave a key with blank data of type in this worker's cache for future use
            * }
            */
            const { worker, cache, manager, transfer, newCache, preserveKey = false } = payload;
            const { type, data } = CACHE[cache];
            const { payload: dataPayload, buffers, reference } = CACHE_TYPES[type].decode(data, transfer && preserveKey);
            const isCavnas = type === "CANVAS";
            const buf = ((transfer || isCavnas) ? buffers : []); // [!] canvases cannot be cloned once a context is bound to them. Receiving worker will copy Canvas content onto a new instance and toss it
            if (manager) {
                self.postMessage({id, type, payload: dataPayload}, buf);
            } else {
                const tid = id + "_" + performance.now().toString();
                TRANSACTIONS[tid] = Promise.withResolvers();
                CHANNELS[worker].postMessage(
                    { id: tid, command: "CACHE", payload: { type, cache: newCache || cache, data: dataPayload }},
                    buf
                );
                await TRANSACTIONS[tid].promise;
                delete TRANSACTIONS[tid];
            }
            if (transfer) {
                if (preserveKey) createCache(cache, type, reference, true);
                else delete CACHE[cache];
            }
            if (!manager) postSuccess(id);
        } else if (command === "DROPCACHE") {
           /* Payload expected:
            * {
            *    cache: UUID,
            * }
            */
           const { cache } = payload;
           delete CACHE[cache];
           postSuccess(id);
        }
    } catch (e) {
        postFailure(id, e)
    }
}

// signal READY to porent
self.postMessage({type: "READY"});