import { Path } from "../math/Path.js";
import { Vector } from "../math/Vector.js";
import { Polygon } from "./Polygon.js";

// basically a bounding box that defines all four corner points (supports rotations)
// supposed to be lightweight
export class Hitbox {
    #edges = new Path(
        new Vector(),
        new Vector(),
        new Vector(),
        new Vector(),
    );
    constructor (topLeft, topRight, bottomRight, bottomLeft) {
        this.#edges.isClosed = true;
        this.#edges.at(0).apply(topLeft);
        this.#edges.at(1).apply(topRight);
        this.#edges.at(2).apply(bottomRight);
        this.#edges.at(3).apply(bottomLeft);
    }
    #isShapeIntersecting (shape) {
        return shape.isIntersecting(this.edges);
    }
    #isHitboxIntersecting (hitbox) {
        return this.edges.points.some((pt) => hitbox.isIntersecting(pt))
            || hitbox.edges.points.some((pt) => this.#isPointIntersecting(pt));
    }
    #isPointIntersecting (point) {    
        const [tl, tr, br, bl] = this.edges.points;
        const cross1 = tr.sub(tl).cross(point.sub(tl));
        const cross2 = br.sub(tr).cross(point.sub(tr));
        const cross3 = bl.sub(br).cross(point.sub(br));
        const cross4 = tl.sub(bl).cross(point.sub(bl));
        return (cross1 >= 0 && cross2 >= 0 && cross3 >= 0 && cross4 >= 0)
            || (cross1 <= 0 && cross2 <= 0 && cross3 <= 0 && cross4 <= 0);
    }
    #isBoundingBoxIntersecting (bbox) {
        return this.#isPointIntersecting(bbox.min)
            || this.#isPointIntersecting(bbox.max)
            || this.edges.points.some((pt) => bbox.isIntersecting(pt));
    }
    isIntersecting (value) {
        if (value?.isVector) {
            return this.#isPointIntersecting(value);
        } else if (value?.isHitbox) {
            return this.#isHitboxIntersecting(value);
        } else if (value?.isBoundingBox) {
            return this.#isBoundingBoxIntersecting(value);
        } else if (value?.isShape) {
            return this.#isShapeIntersecting(value);
        } else return false; // dont throw errors on unknown types
    }
    draw (cursor, close = true) {
        if (close) cursor.beginPath();
        cursor.moveTo(this.topLeft);
        cursor.lineTo(this.topRight);
        cursor.lineTo(this.bottomRight);
        cursor.lineTo(this.bottomLeft);
        if (close) cursor.closePath();
    }
    Polygon () { return new Polygon(this.edges.clone(true)) }

    get isHitbox () { return true }
    get edges () { return this.#edges }
    get topLeft () { return this.#edges.at(0) }
    get topRight () { return this.#edges.at(1) }
    get bottomRight () { return this.#edges.at(2) }
    get bottomLeft () { return this.#edges.at(3) }
    get center () { return Vector.average(this.#edges.points) }
}
