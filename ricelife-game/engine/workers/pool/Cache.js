import { Canvas2DContextCursor } from "/engine/core/controller/display/Canvas2DContextCursor.js";
import { Polygon } from "/engine/core/geometry/Polygon.js";
import { Shape } from "/engine/core/geometry/Shape.js";
import { Vector } from "/engine/core/math/Vector.js";
import { Terrain } from "/engine/core/geometry/Terrain.js";
import { typeString } from "/engine/core/utils/logging.js";
import { TrackableObject } from "/engine/core/utils/tracking/TrackableObject.js";

// [!] we break the project formatting rules here for efficiency. Multiple classes in one file shrinks the number of lookups each worker
//  has to do, but increases overhead (potential bloat) as a tradeoff. -KT
export class Cache extends TrackableObject {
    static TYPES = new Map();
    // unpacks a cache that was sent from another thread
    static decode (cacheObj) {
        const { id, type, payload } = cacheObj;
        return this.TYPES.get(type).decode(id, payload);
    }
    // creates a "reference" (empty cache with specifications)
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
        if (this.isFilled) throw new Error(`[${typeString(this)}]: Can only fill an empty cache`);
    }

    get isCache () { return true }
    get isFilled () { return false }
    get type () { return this.constructor.name }
    get hash () { return undefined }
}

export class CanvasCache extends Cache {
    static decode (id, payload) {
        const cache = new CanvasCache(payload.width, payload.height, id);
        if (payload.img) {
            cache.cursor.drawImage(payload.img, 0, 0);
            payload.img.close();
        }
        return cache;
    }
    #canvas;
    #cursor;
    #isFilled = false;
    constructor (width, height, id = null) {
        super(id);
        this.#canvas = new OffscreenCanvas(width, height);
        this.#cursor = new Canvas2DContextCursor(this.canvas, new Vector(width, height));
    }

    async encode (clone = false) {
        const encoded = super.encode();
        const { width, height } = this.canvas;
        encoded.payload = { width, height };
        if (this.isFilled) {
            const img = clone
                ? await createImageBitmap(this.canvas)
                : this.canvas.transferToImageBitmap();
            encoded.buffers.push(img);
        }
        return encoded;
    }

    get isCanvasCache () { return true }
    get isFilled () { return this.#isFilled }
    get canvas () { return this.#canvas }
    get cursor () {
        this.#isFilled = true;
        return this.#cursor;
    }
    get hash () { return this.cursor.hash }
}

export class PolygonCache extends Cache {
    static decode (id, payload) {
        const polygon = Polygon.fromObject(payload, payload.depth);
        return new PolygonCache(polygon, id);
    }
    #polygon;
    #isFilled = false;
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
            this.#isFilled = true;
        } else if (polygon) {
            this.fill(Polygon.fromObject(polygon, polygon?.depth));
        }
    }

    get isPolygonCache () { return true }
    get isFilled () { return this.#isFilled }
    get polygon () { return this.#polygon }
    get hash () { return this.polygon.hash }
}

export class ShapeCache extends Cache {
    static decode (id, payload) {
        const shape = Shapes.fromObject(payload);
        return new ShapeCache(shape, id);
    }
    #shape;
    #isFilled = false;
    constructor (shape, id = null) {
        super(id);
        this.fill(shape);
    }

    async encode () {
        const encoded = super.encode();
        const { shape } = this;
        encoded.payload = shape.encode();
        encoded.buffers.push(...encoded.payload.buffers);
        return encoded;
    }
    fill (shape) {
        super.fill();
        if (shape?.isShape) {
            this.#shape = shape;
            this.#isFilled = true;
        } else if (shape) {
            this.fill(Shape.fromObject(shape));
        }
    }

    get isShapeCache () { return true }
    get isFilled () { return this.#isFilled }
    get shape () { return this.#shape }
    get hash () { return this.#shape.hash }
}

export class TerrainCache extends Cache {
    static decode (id, payload) {
        const terrain = Terrain.fromObject(payload);
        return new TerrainCache(terrain, id);
    }
    #terrain;
    #isFilled = false;
    constructor (terrain, id = null) {
        super(id);
        this.fill(terrain);
    }
    fill (terrain) {
        super.fill();
        if (terrain?.isTerrain) {
            this.#terrain = terrain;
            this.#isFilled = true;
        } else if (terrain) {
            this.fill(Terrain.fromObject(terrain));
        }
    }

    get isTerrainCache () { return true }
    get isFilled () { return this.#isFilled }
    get terrain () { return this.#terrain }
}

Cache.TYPES.set(CanvasCache.name, CanvasCache);
Cache.TYPES.set(TerrainCache.name, TerrainCache);
Cache.TYPES.set(PolygonCache.name, PolygonCache);
Cache.TYPES.set(ShapeCache.name, ShapeCache);
