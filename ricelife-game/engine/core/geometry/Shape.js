import { BoundingBox } from "./BoundingBox.js";
import { Transform } from "./Transform.js";
import { Vector } from "../math/Vector.js";
import { Polygon } from "./Polygon.js";
import { typeString } from "../utils/logging.js";

export class Shape {
    static TYPES = new Map();
    static DRAW_PRECISION = 2; // during draw() calls, apply toFixed on coordinates to prevent flickering artifacts. Values greater than 4 may cause flickering depending on hardware. - KT
    static fromObject (payload) {
        return Shape.TYPES.get(payload.type).fromObject(payload);
    }
    #blob = {}
    #transform = new Transform();
    #globalTransform = new Transform(); // all transforms applied, compounded
    #bbox = new BoundingBox();
    // all subclasses of that need to support decoding Shape MUST have defaultable values and permit zero constructor parameters
    constructor () {
        if (this.constructor === Shape) throw new Error(`[${typeString(this)}]: Cannot be initalized from parent class`);
    }
    toJSON () { return {blob: this.blob, origin: this.origin.toJSON(), globalTransform: this.globalTransform.toJSON(), type: this.constructor.TYPE} }
    encode () { return {...this.toJSON(), buffers: []} }
    applyTransform () { // children can manipulate blob data before super calling this methood
        if (!this.transform.scale.isFinite
            || !this.transform.offset.isFinite
            || !this.transform.rotation.isFinite
        ) throw new Error(`[${typeString(this)}]: Cannot apply transform with corrupt values\n\t${this.transform.toString()}`);
        if (this.transform.hasUpdate)
            this.globalTransform.add(this.transform, true);
        this.transform.reset();
    }
    overlap (other, flatten = false) {
        if (other?.isPolygon) return this.Polygon(1).overlap(other, flatten);
        else if (other?.isShape) return this.Polygon(1).overlap(other.Polygon(1), flatten);
        else throw new Error(`[${typeString(this)}]: Cannot run overlap operation on unsupported type ${typeString(other)}`);
    }
    moveTo (x = null, y = null) { // move to point, instead of adding to transform
        this.transform.save();
        this.transform.reset();
        if (x?.isVector) this.transform.offset = x.sub(this.origin);
        else {
            if (Number.isFinite(x)) this.transform.offset.x = x - this.origin.x;
            if (Number.isFinite(y)) this.transform.offset.y = y - this.origin.y;
        }
        this.applyTransform();
        this.transform.restore();
    }
    getBoundingBox () { return this.#bbox }
    // [!] holy shit man
    // children should overload for optimizations, but not needed
    isPolygonIntersecting (value) { return value.isIntersecting(this.origin) || value.edgePoints.some((point) => this.isVectorIntersecting(point)) }
    isPolyIntersecting (value) { return this.isPolygonIntersecting(value.polygon) }
    isPolygonInside (value) { return value.isIntersecting(this.origin) && value.edgePoints.every((point) => this.isVectorIntersecting(point)) }
    isPolyInside (value) { return this.isPolygonInside(value.polygon) }
    // counts overlapping edge as an intersection
    isIntersecting (value) {
        const bbox = this.getBoundingBox();
        if (value?.isVector && !bbox.isIntersecting(value)) return false;
        else if ((value?.isShape || value?.isPolygon) && !bbox.isIntersecting(value.getBoundingBox())) return false;
        else if (value?.isVector) return this.isVectorIntersecting(value);
        else if (value?.isPath) return this.isPathIntersecting(value);
        else if (value?.isPolygon) return this.isPolygonIntersecting(value);
        else if (value?.isCircle) return this.isCircleIntersecting(value);
        else if (value?.isTriangle) return this.isTriangleIntersecting(value);
        else if (value?.isPoly) return this.isPolyIntersecting(value);
        else throw new Error(`[${typeString(this)}] Error: Unable to compute intersect of unsupported type ${typeString(value)}`);
    }
    // Checks if VALUE is inside of THIS
    // counts overlapping edges as still inside
    isInside (value) {
        const bbox = this.getBoundingBox();
        if (value?.isVector && !bbox.isIntersecting(value)) return false;
        else if ((value?.isShape || value?.isPolygon) && !bbox.isIntersecting(value.getBoundingBox())) return false;
        else if (value?.isVector) return this.isVectorIntersecting(value);
        else if (value?.isPath) return this.isPathInside(value);
        else if (value?.isPolygon) return this.isPolygonInside(value);
        else if (value?.isCircle) return this.isCircleInside(value);
        else if (value?.isTriangle) return this.isTriangleInside(value);
        else if (value?.isPoly) return this.isPolyInside(value);
        throw new Error(`[${typeString(this)}] Error: Unable to check enclosure of unsupported type ${typeString(value)}`);
    }
    isBordering (value) {
        return this.isIntersecting(value) && !this.isInside(value);
    }
    get isShape () { return true }
    get blob () { return this.#blob }
    get transform () { return this.#transform }
    get globalTransform () { return this.#globalTransform }

    // === [ children should overload the following methods ] ===
    Polygon (resolution = 1) { return new Polygon() }
    draw (cursor, close = true) {}
    clone () {}
    // type checks are omitted on the following methods for performance, should be done and routed through isIntersecting or isInside
    isVectorIntersecting (value) { throw new Error() }
    isPathIntersecting (value) { return value.points.some((point) => this.isVectorIntersecting(point)) }
    isCircleIntersecting (value) { return value.isIntersecting(this) }
    isTriangleIntersecting (value) { return value.isIntersecting(this) }
    isPathInside (value) { return value.points.every((point) => this.isVectorIntersecting(point)) }
    isCircleInside (value) { throw new Error() }
    isTriangleInside (value) { throw new Error() }
    get hash () { return this.Polygon(1).hash }
    get origin () { return new Vector() }
    get center () { return new Vector() }
}
