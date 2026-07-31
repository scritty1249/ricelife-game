import { Polygon } from "/engine/core/geometry/Polygon.js";
import { Terrain } from "/engine/core/geometry/Terrain.js";
import { Color } from "/engine/core/math/Color.js";
import { Vector } from "/engine/core/math/Vector.js";
import { Properties } from "/engine/core/projectile/collision/Properties.js";
import { traceAmmo } from "/engine/core/projectile/utils.js";
import { Cache, TerrainCache } from "/engine/workers/pool/Cache.js";
import { AmmoPool } from "/engine/core/load/pool/AmmoPool.js";

const _queryString = self.location.search;
const _urlParams = new URLSearchParams(_queryString);
const ID = _urlParams.get("id");
const LOG_LEVEL = _urlParams.get("logLevel");
const CACHE = {};
const CHANNELS = {};
const TRANSACTIONS = {};
const CONSOLE_PREFIX = `[WebWorker] (${ID})`;
const AMMO_TYPES = new AmmoPool("/engine/ammotypes");

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

function createCache (data) { // create new from encoded cache
    const { id, type } = data;
    if (Cache.TYPES.has(type)) {
        if (id in CACHE) {
            if (LOG_LEVEL >= 3) console.debug(`${CONSOLE_PREFIX}: Overwriting ${CACHE[id]?.isFilled ? "" : "empty "}cache ${id} - CREATE`);
        }
        CACHE[id] = data?.isCache ? data : Cache.decode(data);
        return true;
    }
    return false;
}

function fillCache (id, data) { // create from payload data
    if (id in CACHE) {
        const target = CACHE[id];
        if (target?.isFilled) {
            if (LOG_LEVEL >= 3) console.debug(`${CONSOLE_PREFIX}: Overwriting cache ${id} - FILL`);
        }
        target.fill(data);
        return true;
    }
    return false;
}

const onworkermessage = (e) => {
    const { command, id, payload } = e.data;
    const port = e.target;
    if (LOG_LEVEL >= 2) console.debug(`${CONSOLE_PREFIX}: Transaction ${id} receieved from peer\n\t${command}: `,  payload);
    if (command === "CACHE") {
        if (createCache(payload)) {
            port.postMessage({command: "ACK", id});
            postSuccess("CACHEUPDATE_" + id);
        } else {
            const err = new Error(`[WebWorker]  (${ID}): Failed to create cache "${payload?.id}"`);
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
        if ((command !== "ADDWKR" && LOG_LEVEL >= 2) || (command === "ADDWKR" && LOG_LEVEL >= 4))
            console.debug(`${CONSOLE_PREFIX}: Transaction ${id} receieved from parent\n\t${command ? command : type}: `,  payload);
        if (command) {
            processManagerCommand(command, id, payload);
        } else if (type === "TRACEAMMO") {
            /* Payload expected:
             * {
             *    ammo: String,
             *    params: Array,
             *    terrain: Terrain32 | UUID, // encoded terrain
             *    collisions: [...Polygon32 | UUID], // at least one of these must have userData.collision flag set to Properties.Collision.TERRAIN
             *    increment: Number,
             *    limit: Number
             * }
             */
            const { ammo, collisions, params, increment, limit, terrain } = payload;
            if (!AMMO_TYPES.has(ammo)) AMMO_TYPES.add(ammo);
            const terrainCollider = typeof terrain === "string"
                ? getCache(terrain).terrain
                : Terrain.fromObject(terrain);
            const colliders = collisions.map((target) =>
                typeof target === "string"
                    ? getCache(target).polygon
                    : Polygon.fromObject(target, target.depth)
            );
            const result = traceAmmo((await AMMO_TYPES.onready(ammo)), params, increment, limit, terrainCollider, colliders);
            if (!result.finished) console.debug(`${CONSOLE_PREFIX}: Trace operation timed out in Transaction ${id}`);
            postResponse(id, result);
        } else if (type === "CUTTERRAIN") {
            /* Payload expected:
             * {
             *    callback: Boolean, (send it back, will leave a copy in worker memory)
             *    source: Terrain32 | UUID,
             *    cuts: [ ...Polygon32 | UUID> ],
             *    dest: UUID, (cache result, can be used to mutate original)
             * }
             */
            const { source, cuts, callback, dest } = payload;
            const mutate = dest === source;
            const terrain = typeof source === "string"
                ? mutate
                    ? getCache(source).terrain
                    : getCache(source).terrain.clone(true)
                : Terrain.fromObject(source);
            for (const cut of cuts) {
                terrain.polygon.cut(
                    typeof cut === "string"
                        ? getCache(cut).polygon
                        : Polygon.fromObject(cut, cut.depth),
                    true
                );
            }
            if (!mutate) createCache(new TerrainCache(terrain, dest));
            const result = {};
            let bufs = [];
            if (callback) {
                result.terrain = terrain.Float32();
                bufs = result.terrain.buffers;
            }
            postResponse(id, result, bufs);
        } else if (type === "DRAWTERRAIN") {
            /* Payload expected:
             * {
             *    canvas: UUID,
             *    terrain: Terrain32 | UUID,
             * }
             */
            const { canvas, cursor } = getCache(payload.canvas);
            const isUuid = typeof payload.terrain === "string";
            const terrain = isUuid
                ? getCache(payload.terrain).terrain
                : Terrain.fromObject(payload.terrain);
            cursor.clear();            
            terrain.draw(cursor);
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
             *    target: UUID
             * }
             */
            const { hash } = getCache(payload.target);
            postResponse(id, { hash });
        } else if (command === "CREATECACHE") {
           /* Payload expected:
            * {
            *   cache: Cache, // encoded
            * }
            */
            const { cache } = payload;
            if (createCache(cache)) postSuccess(id);
            else postFailure(id, new Error(`[WebWorker]  (${ID}): Failed to initalize cache "${cache?.id}"`));
        } else if (command === "FILLCACHE") {
           /* Payload expected:
            * {
            *   target: UUID,
            *   data: <Object>32, // Float32 (encoded) version of cache source
            * }
            */
            const { target, data } = payload;
            if (fillCache(target, data)) postSuccess(id);
            else postFailure(id, new Error(`[WebWorker]  (${ID}): Failed to fill cache "${target}"`));
        } else if (command === "SENDCACHE") { // [!] Canvas caches are transfer-only.
           /* Payload expected:
            * {
            *    manager: Boolean, send cache to manager instead of another worker
            *    source: UUID,
            *    dest?: UUID, new cache id to store at. If undefined, will reuse original cache key
            *    worker?: UUID,
            *    clone?: Boolean (false) transfer payload as clone
            * }
            */
            const { worker, source, manager, dest, clone = false } = payload;
            const cache = getCache(source);
            const data = await cache.encode(clone);
            const targetID = dest || source;
            const changeID = source !== targetID;
            if (changeID) data.id = targetID;
            if (manager) {
                self.postMessage({id, payload: data}, data.buffers);
                if (!clone) delete CACHE[source];
            } else if (ID !== worker) {
                const tid = id + "_" + performance.now().toString();
                TRANSACTIONS[tid] = Promise.withResolvers();
                CHANNELS[worker].postMessage(
                    { id: tid, command: "CACHE", payload: data },
                    data.buffers
                );
                await TRANSACTIONS[tid].promise;
                delete TRANSACTIONS[tid];
                if (!clone) delete CACHE[source];
            } else if (changeID) {
                if (createCache(data) && !clone)
                    delete CACHE[source];
            }   
            if (!manager) postSuccess(id);
        } else if (command === "DROPCACHE") {
           /* Payload expected:
            * {
            *    target: UUID,
            * }
            */
           const { target } = payload;
           const cache = getCache(target);
           delete CACHE[target];
           postSuccess(id);
        }
    } catch (e) {
        postFailure(id, e)
    }
}

// signal READY to porent
self.postMessage({type: "READY"});
if (LOG_LEVEL >= 4) console.debug(`${CONSOLE_PREFIX}: Ready`);