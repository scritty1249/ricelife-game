import { Canvas2DContextCursor } from "/engine/core/controller/display/Canvas2DContextCursor.js";
import { Polygon } from "/engine/core/geometry/Polygon.js";
import { Shape } from "/engine/core/geometry/Shape.js";
import { Vector } from "/engine/core/math/Vector.js";
import { Terrain } from "/engine/core/geometry/Terrain.js";
import { typeString } from "/engine/core/utils/logging.js";
import { TrackableObject } from "/engine/core/utils/tracking/TrackableObject.js";

export const CacheType = {
    POLY: {
        create (path, holes, depth) {
            return this.encode({path, holes, depth});
        },
        decode: (data) => {
            const { depth } = data.poly;
            const poly = data.poly.Float32(depth); // [!] We are not expecting our holes to have more goddamn holes, but ffs JUST IN CASE...
            const { buffers } = poly;
            const reference = { depth };
            delete poly.buffers;
            return {
                buffers, reference,
                payload: poly,
            };
        },
        encode: (payload, peer = true) => {
            const poly = payload?.isPolygon ? payload : Polygon.fromObject(payload, payload.depth);
            return peer ? { poly } : poly;
        },
        encodeReference: (reference) => {
            return {
                poly: new Polygon(),
                depth: reference.depth
            }
        },
        hash: (data) => {
            return data?.poly?.hash;
        },
    },
    CANVAS: {
        create (width, height) {
            const canvas = new OffscreenCanvas(width, height);
            return this.encode(canvas);
        },
        decode: (data) => {
            const { canvas } = data;
            const reference = { width: canvas?.width, height: canvas?.height };
            const img = canvas.transferToImageBitmap();
            return {reference, payload: img, buffers: [img]};
        },
        encode: (payload, peer = true) => {
            if (peer) {
                const { width, height } = payload;
                const canvas = new OffscreenCanvas(width, height); // [!] inefficient but Contexts are non-transferrable and permanently linked to each Canvas
                const cursor = new Canvas2DContextCursor(canvas, new Vector(width, height));
                cursor.drawImage(payload, 0, 0);
                payload?.close?.();
                return { canvas, cursor };
            } else {
                return payload;
            }
        },
        encodeReference: (reference) => {
            const { width, height } = reference;
            const canvas = new OffscreenCanvas(width, height);
            const cursor = new Canvas2DContextCursor(canvas, new Vector(width, height));
            return { canvas, cursor };
        },
        hash: (data) => {
            return data?.cursor?.hash;
        },
    },
    SHAPE: {
        create (payload) { return this.encode(payload, true) },
        decode (data) {
            const payload = data.decode();
            return { payload, buffers: payload?.buffers || [] };
        },
        encode (payload, peer = true) {
            const shape = Shape.fromObject(payload);
            return peer ? { shape, reference: {type: shape.constructor.TYPE} } : shape
        },
        encodeReference (reference) {
            return { shape: new Shape.TYPES[reference.type]() }
        },
        hash (data) {
            return data?.shape?.hash;
        },
    },
    TERRAIN:{
        create (path, holes, depth) {
            return this.encode({path, holes, depth});
        },
        decode: (data) => {
            const { depth } = data.poly;
            const poly = data.poly.Float32(depth); // [!] We are not expecting our holes to have more goddamn holes, but ffs JUST IN CASE...
            const { buffers } = poly;
            const reference = { depth };
            delete poly.buffers;
            return {
                buffers, reference,
                payload: poly,
            };
        },
        encode: (payload, peer = true) => {
            const poly = payload?.isPolygon ? payload : Polygon.fromObject(payload, payload.depth);
            return peer ? { poly } : poly;
        },
        encodeReference: (reference) => {
            return {
                poly: new Polygon(),
                depth: reference.depth
            }
        },
        hash: (data) => {
            return data?.poly?.hash;
        },
    },
};
Object.freeze(CacheType);

// [!] we break the project formatting rules here for efficiency. Multiple classes in one file shrinks the number of lookups each worker
//  has to do, but increases overhead (potential bloat) as a tradeoff. -KT
export class Cache extends TrackableObject {
    static TYPES = new Map();
    // unpacks a cache that was sent from another thread
    static decode (cacheObj) {
        const { id, type, payload } = cacheObj;
        return this.TYPES.get(type).decode(id, payload);
    }
    // creates a "refernece" (empty cache with specifications)
    constructor (id) { super(id) }

    async encode () {
        return {
            id: this.id,
            type: this.constructor.name,
            hash: this.hash,
            payload: undefined,
            buffers: []
        }
    }
    fill (...args) {
        if (!this.isEmpty) throw new Error(`[${typeString(this)}]: Can only fill an empty cache`);
    }

    get isCache () { return true }
    get isEmpty () { return true }
    get hash () { return undefined }
}

export class CanvasCache extends Cache {
    static decode (id, payload) {
        const cache = new CanvasCache(payload.width, payload.height, id);
        cache.cursor.drawImage(payload.img, 0, 0);
        return cache;
    }
    #canvas;
    #cursor;
    constructor (width, height, id = null) {
        super(id);
        this.#canvas = new OffscreenCanvas(width, height);
        this.#cursor = new Canvas2DContextCursor(this.canvas, new Vector(width, height));
    }

    async encode (clone = false) {
        const encoded = super.encode();
        const { width, height } = this.canvas;
        const img = clone
            ? await createImageBitmap(this.canvas)
            : this.canvas.transferToImageBitmap();
        encoded.payload = { img, width, height };
        encoded.buffers.push(img);
        return encoded;
    }

    get isCanvasCache () { return true }
    get isEmpty () { return false }
    get canvas () { return this.#canvas }
    get cursor () { return this.#cursor }
    get hash () { return this.cursor.hash }
}

export class PolygonCache extends Cache {
    static decode (id, payload) {
        const polygon = Polygon.fromObject(payload, payload.depth);
        return new PolygonCache(polygon, id);
    }
    #polygon;
    #isEmpty = true;
    constructor (polygon, id = null) {
        super(id);
        this.fill(polygon);
    }

    async encode () {
        const encoded = super.encode();
        const { polygon } = this;
        encoded.payload = polygon.Float32(polygon.depth);
        encoded.buffers.push(...encoded.payload.buffers);
        return encoded;
    }
    fill (polygon) {
        super.fill();
        if (polygon?.isPolygon) {
            this.#polygon = polygon;
            this.#isEmpty = false;
        }
    }

    get isPolygonCache () { return true }
    get isEmpty () { return this.#isEmpty }
    get polygon () { return this.#polygon }
    get hash () { return this.polygon.hash }
}

export class ShapeCache extends Cache {
    static decode (id, payload) {
        const shape = Shapes.fromObject(payload);
        return new ShapeCache(shape, id);
    }
    #shape;
    constructor (shape, id = null) {
        super(id);
        this.#shape = shape?.isShape
            ? shape
            : new Shape.TYPES.get(shape)()
    }

    async encode () {
        const encoded = super.encode();
        const { shape } = this;
        encoded.payload = shape.encode();
        encoded.buffers.push(...encoded.payload.buffers);
        return encoded;
    }

    get isShapeCache () { return true }
    get shape () { return this.#shape }
    get hash () { return this.#shape.hash }
}

export class TerrainCache extends Cache {
    static decode (id, payload) {
        const terrain = Terrain.fromObject(payload);
        return new TerrainCache(terrain, id);
    }
    #terrain;
    constructor (terrain, id = null) {
        super(id);

    }

    get isTerrainCache () { return true }
    get terrain () { return this.#terrain }
}

Cache.TYPES.set(CanvasCache.name, CanvasCache);
Cache.TYPES.set(TerrainCache.name, TerrainCache);
Cache.TYPES.set(PolygonCache.name, PolygonCache);
Cache.TYPES.set(ShapeCache.name, ShapeCache);