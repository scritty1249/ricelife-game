
import { Polygon, Color, Vector } from "../geometry/geometry.js";
import { drawTerrain } from "../terrain/terrain.js";
import { CACHE_TYPES } from "./types.js";
import { Properties, traceAmmo } from "../projectile/projectile.js";
import { AmmoPool } from "../lobby/lobby.js"; 

const _queryString = self.location.search;
const _urlParams = new URLSearchParams(_queryString);
const ID = _urlParams.get("id");
const LOG_LEVEL = _urlParams.get("logLevel");
const CACHE = {};
const CHANNELS = {};
const TRANSACTIONS = {};
const CONSOLE_PREFIX = `[WebWorker] (${ID})`;
const AMMO_TYPES = new AmmoPool(new URL('.', import.meta.url).pathname + "../projectile/types");


function postSuccess (id) { postResponse(id) }

function getCache (id) {
    // accesses cache and throws an error if it doesn't exist
    if (id in CACHE && CACHE[id] !== undefined) return CACHE[id];
    throw new Error(`${CONSOLE_PREFIX}: Cache ${id} does not exist in this Worker`);
}

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
        if (id in CACHE) {
            if (LOG_LEVEL >= 3) console.debug(`${CONSOLE_PREFIX}: Overwriting cache ${id} - INIT`);
        }
        CACHE[id] = { type, data: TYPE.create(...args) };
        return true;
    }
    return false;
}

function createCache (id, type, payload, reference = false, isTransfer = false) { // create from payload
    if (type in CACHE_TYPES) {
        const TYPE = CACHE_TYPES[type];
        if (id in CACHE) {
            if (LOG_LEVEL >= 3) console.debug(`${CONSOLE_PREFIX}: Overwriting cache ${id} - ${isTransfer ? "TRANSFER" : "CREATE"}`);
        }
        CACHE[id] = { type, data: reference ? TYPE.encodeReference(payload) : TYPE.encode(payload) };
        return true;
    }
    return false;
}

const onworkermessage = (e) => {
    const { command, id, payload } = e.data;
    const port = e.target;
    if (LOG_LEVEL >= 2) console.debug(`${CONSOLE_PREFIX}: Transaction ${id} receieved from peer\n\t${command}: `,  payload);
    if (command === "CACHE") {
        if (createCache(payload.cache, payload.type, payload.data, false, true)) {
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
        if (LOG_LEVEL >= 2) console.debug(`${CONSOLE_PREFIX}: Transaction ${id} receieved from parent\n\t${command ? command : type}: `,  payload);
        if (command) {
            processManagerCommand(command, id, payload);
        } else if (type === "TRACESHOT") {
            /* Payload expected:
             * {
             *    ammo: String,
             *    params: Array,
             *    collisions: [...Polygon64 | UUID], // at least one of these must have userData.collision flag set to Properties.Collision.TERRAIN
             *    increment: Number,
             *    limit: Number
             * }
             */
            const { ammo, collisions, params, increment, limit } = payload;
            if (!AMMO_TYPES.has(ammo)) AMMO_TYPES.add(ammo);
            const targetPolys = collisions.map((target) =>
                typeof target === "string"
                    ? getCache(target).data?.poly
                    : Polygon.fromObject(target, target.depth));
            const result = traceAmmo((await AMMO_TYPES.onready(ammo)), params, increment, limit, targetPolys);
            if (!result.finished) console.debug(`${CONSOLE_PREFIX}: Trace operation timed out in Transaction ${id}`);
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
            const polygon = typeof subject === "string"
                ? cache === subject
                    ? getCache(subject).data?.poly
                    : getCache(subject).data?.poly?.clone(true)
                : Polygon.fromObject(subject, subject.depth);
            for (const cut of cuts) {
                polygon.cut(
                    typeof cut === "string"
                        ? getCache(cut).data?.poly
                        : Polygon.fromObject(cut, cut.depth),
                    true
                );
            }
            if (subject !== cache) createCache(cache, "POLY", polygon);
            const result = {};
            let bufs = [];
            if (callback) {
                result.polygon = polygon.Float32(polygon.depth);
                bufs = result.polygon.buffers;
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
                ? getCache(polygon).data?.poly
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
                ? getCache(subject).data?.canvas
                : subject;
            const { canvas, cursor } = getCache(cache).data;
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
            const { cursor } = getCache(payload.cache).data;
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
        } else if (command === "HASHCACHE") {
            /* Payload expected:
             * {
             *    cache: UUID
             * }
             */
            const { cache } = payload;
            const { type, data } = getCache(cache);
            postResponse(id, {hash: CACHE_TYPES[type].hash(data) });
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
            const { type, data } = getCache(cache);
            const { payload: dataPayload, buffers, reference } = CACHE_TYPES[type].decode(data, transfer && preserveKey);
            const isCavnas = type === "CANVAS";
            const buf = ((transfer || isCavnas) ? buffers : []); // [!] canvases cannot be cloned once a context is bound to them. Receiving worker will copy Canvas content onto a new instance and toss it
            if (manager) {
                self.postMessage({id, type, payload: dataPayload}, buf);
            } else if (worker === ID) {
                CACHE[newCache || cache] = CACHE[cache];
            } else {
                const tid = id + "_" + performance.now().toString();
                TRANSACTIONS[tid] = Promise.withResolvers();
                CHANNELS[worker].postMessage(
                    { id: tid, command: "CACHE", payload: { type, cache: (newCache || cache), data: dataPayload }},
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