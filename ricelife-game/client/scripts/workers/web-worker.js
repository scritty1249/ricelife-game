
import { Polygon, Color, Vector, Circle } from "../geometry/geometry.js";
import { drawTerrain } from "../terrain/terrain.js";
import { Shot } from "../projectile/projectile.js";
import { CACHE_TYPES } from "./types.js";

/* Polygon64: 
 * {
 *    path: Float64Array,
 *    holes: [...Polygon64]
 * }
 */

const _queryString = self.location.search;
const _urlParams = new URLSearchParams(_queryString);
const ID = _urlParams.get("id");

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
    self.postMessage({payload, id, state: currentState()}, transfer);
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
    console.debug(`[WebWorker] (${ID}): Transaction ${id} receieved from peer\n`, {command, payload});
    if (command === "CACHE") {
        if (createCache(payload.cache, payload.type, payload.data)) {
            console.info(`[WebWorker] (${ID}) Info: Received ${payload.type} cache transfer "${payload.cache}"`);
            port.postMessage({command: "ACK", id});
        } else {
            const err = new Error(`[WebWorker]  (${ID}) Error: Failed to create cache "${payload.cache}"`);
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
        console.debug(`[WebWorker] (${ID}): Transaction ${id} receieved from parent\n`,  command ? {command, payload} : {type, payload});
        if (command) {
            processManagerCommand(command, id, payload);
        } else if (type === "INTERSECTPROJ") {
            /* Payload expected:
             * {
             *    hitbox: Polygon64 | UUID,
             *    target: Polygon64 | UUID,
             *    origin: Vector,
             *    velocity: Vector,
             *    acceleration: Vector,
             *    drag: Number,
             *    increment: Number,
             *    limit: Number
             * }
             */
            const { hitbox, target, origin, velocity, acceleration, drag, increment, limit } = payload;
            const targetPoly = typeof target === "string"
                ? CACHE[target]?.data?.poly
                : Polygon.fromObject(target, target.depth);
            const hitboxPoly = typeof hitbox === "string"
                ? CACHE[hitbox]?.data?.poly
                : Polygon.fromObject(hitbox, hitbox.depth);
            const proj = new Shot(Vector.fromObject(origin), Vector.fromObject(velocity), Vector.fromObject(acceleration), drag, hitboxPoly);
            const result = proj.intersectAt(targetPoly, increment, limit);
            postResponse(id, result);
        } else if (type === "INTERSECTCIRCLEPROJ") { // specificlly optimized, basically the same as INTERSECTPROJ
            /* Payload expected:
             * {
             *    target: Polygon64 | UUID,
             *    radius: Number,
             *    resolution: Number,
             *    origin: Vector,
             *    velocity: Vector,
             *    acceleration: Vector,
             *    drag: Number,
             *    increment: Number,
             *    limit: Number
             * }
             */
            const { target, radius, resolution, origin, velocity, acceleration, drag, increment, limit } = payload;
            const targetPoly = typeof target === "string"
                ? CACHE[target]?.data?.poly
                : Polygon.fromObject(target, target.depth);
            const hitboxPoly = new Circle(Vector.fromObject(origin), radius, resolution);
            const proj = new Shot(Vector.fromObject(origin), Vector.fromObject(velocity), Vector.fromObject(acceleration), drag, hitboxPoly);
            const result = proj.intersectAt(targetPoly, increment, limit);
            postResponse(id, result);
        } else if (type === "CUTPOLY") {
            /* Payload expected:
             * {
             *    callback: Boolean, (send it back)
             *    subject: Polygon64 | UUID,
             *    cuts: [ ...<Polygon64 | UUID> ],
             *    cache?: UUID, (cache result, otherwise mutate original)
             * }
             */
            const { subject, cuts, callback, cache } = payload;
            const isUuid = typeof subject === "string";
            const depth = isUuid
                ? CACHE[subject]?.data?.depth
                : subject.depth;
            const polygon = isUuid
                ? cache
                    ? CACHE[subject]?.data?.poly?.clone(true)
                    : CACHE[subject]?.data?.poly
                : Polygon.fromObject(subject, depth);
            for (const cut of cuts) {
                polygon.cut(
                    typeof cut === "string"
                        ? CACHE[cut]?.data?.poly
                        : Polygon.fromObject(cut, depth),
                    true
                );
            }
            if (cache) createCache(cache, "POLY", polygon);
            const result = {};
            let bufs = [];
            if (callback) {
                const { path, holes, buffers } = polygon.Float64(depth); // [!] We are not expecting our holes to have more goddamn holes, but ffs JUST IN CASE...
                result.polygon = {path, holes};
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
             *    target: UUID,
             *    x: Number,
             *    y: Number,
             *    width?: Number,
             *    height?: Number,
             *    duplicate?: Boolean (false) (keep a copy of the image cached when transferring the result back)
             * }
             */
            const { subject, target, x, y, width, height, duplicate, callback = false } = payload;
            const from = typeof subject === "string"
                ? CACHE[subject]?.data?.canvas
                : subject;
            const { canvas, cursor } = CACHE[target]?.data;
            if (width === undefined || height === undefined) cursor.drawImage(from, x, y);
            else cursor.drawImage(from, x, y, width, height);
            if (callback) {
                let image;
                if (duplicate) {
                    image = await createImageBitmap(canvas);
                } else {
                    image = canvas.transferToImageBitmap();
                    delete CACHE[target];
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
            else null; // [!] TODO: post error message
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
            else null; // [!] TODO: post error message
        } else if (command === "SENDCACHE") { // [!] Canvas caches are transfer-only.
           /* Payload expected:
            * {
            *    manager: Boolean,
            *    cache: UUID,
            *    transfer: Boolean,
            *    worker?: UUID
            *    reference?: Boolean (false) when trasnferring payload, leave a key with blank data of type in this worker's cache for future use
            * }
            */
            const { worker, cache, manager, transfer, reference = false } = payload;
            const { type, data } = CACHE[cache];
            const { payload: dataPayload, buffers, reference: ref } = CACHE_TYPES[type].decode(data, transfer && reference);
            const isCavnas = type === "CANVAS";
            const buf = (transfer || isCavnas ? buffers : []); // [!] canvases cannot be cloned once a context is bound to them. Receiving worker will copy Canvas content onto a new instance and toss it
            if (manager) {
                self.postMessage({id, type, payload: dataPayload}, buf);
            } else {
                const tid = id + performance.now().toString();
                TRANSACTIONS[tid] = Promise.withResolvers();
                CHANNELS[worker].postMessage(
                    { id: tid, command: "CACHE", payload: { type, cache, data: dataPayload }},
                    buf
                );
                await TRANSACTIONS[tid].promise;
                delete TRANSACTIONS[tid];
            }
            if (transfer)
                if (reference) createCache(cache, type, ref, true);
                else delete CACHE[cache];
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