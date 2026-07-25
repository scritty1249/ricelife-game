import { Vector } from "../math/Vector.js";
import { equals } from "../math/utils.js";
import { typeString } from "../utils/logging.js";

export class BoundingBox {
    static fromHitbox (hitbox) {
        const bbox = new BoundingBox();
        bbox.min.x = hitbox.edges.reduce((acc, {x: curr}) => Math.min(acc, curr), hitbox.edges.at(0).x);
        bbox.min.y = hitbox.edges.reduce((acc, {y: curr}) => Math.min(acc, curr), hitbox.edges.at(0).y);
        bbox.max.x = hitbox.edges.reduce((acc, {x: curr}) => Math.max(acc, curr), hitbox.edges.at(0).x);
        bbox.max.y = hitbox.edges.reduce((acc, {y: curr}) => Math.max(acc, curr), hitbox.edges.at(0).y);
        return bbox;
    }
    static fromPath (path) {
        const bbox = new BoundingBox(path.at(0), path.at(0));
        return bbox.add(path, true);
    }
    // when accumulate is set to a BoundingBox, all bboxes will be merged into the accumulator
    static merge (bboxes, accumulator = undefined) {
        const bbox = accumulator?.isBoundingBox ? accumulator : new BoundingBox();
        return bbox.merge(bboxes, true);
    }
    // when accumulate is set to a BoundingBox, all bboxes will be overlapped into the accumulator
    static overlap (bboxes, accumulator = undefined) {
        const bbox = accumulator?.isBoundingBox ? accumulator : bboxes[0]?.isBoundingBox ? bboxes.pop().clone() : new BoundingBox();
        return bbox.overlap(bboxes, true);
    }
    #min = new Vector();
    #max = new Vector();
    constructor (min = undefined, max = undefined) {
        if (min?.isVector) this.min.apply(min);
        if (max?.isVector) this.max.apply(max);
    }

    isIntersecting (value) {
        if (value?.isVector) {
            return !(value.x < this.min.x
                    || value.x > this.max.x
                    || value.y < this.min.y
                    || value.y > this.max.y
                );
        } else if (value?.isBoundingBox) {
            return !(value.max.x < this.min.x
                    || value.min.x > this.max.x
                    || value.max.y < this.min.y
                    || value.min.y > this.max.y
                );
        } else if (value?.isPath) {
            const pts = value.points;
            if (!pts.length) return false;
            if (pts.some((point) => this.isIntersecting(point))) return true;
            const length = value.isClosed ? pts.length : pts.length - 1;
            for (let i = 0; i < length; i++) {
                const start = pts[i];
                const end = pts[(i + 1) % pts.length];
                if (this.getIntersection(start, end) !== null) return true; 
            }
            return false;
        } else return false; // dont throw errors on unknown types
    }
    getIntersection (origin, target) {
        const dx = target.x - origin.x;
        const dy = target.y - origin.y;
        let tMin = -Infinity, tMax = Infinity;
        if (dx === 0) {
            if (origin.x < this.min.x || origin.x > this.max.x) return null;
        } else {
            const t1 = (this.min.x - origin.x) / dx;
            const t2 = (this.max.x - origin.x) / dx;
            tMin = Math.max(tMin, Math.min(t1, t2));
            tMax = Math.min(tMax, Math.max(t1, t2));
        }
        if (dy === 0) {
            if (origin.y < this.min.y || origin.y > this.max.y) return null;
        } else {
            const t1 = (this.min.y - origin.y) / dy;
            const t2 = (this.max.y - origin.y) / dy;
            tMin = Math.max(tMin, Math.min(t1, t2));
            tMax = Math.min(tMax, Math.max(t1, t2));
        }
        if (tMin > tMax) return null;
        const t = this.isIntersecting(origin) ? tMax : tMin;
        return (t >= 0 && t <= 1) ? new Vector(origin.x + dx * t, origin.y + dy * t) : null;
    }
    merge (others = [], mutate = false) {
        const list = Array.isArray(others) ? others : [others];
        const bbox = mutate ? this : this.clone();
        for (const other of list)
            bbox.add(other, true);
        return bbox; // for chaining
    }
    overlap (others = [], mutate = false) {
        let minX = this.min.x;
        let minY = this.min.y;
        let maxX = this.max.x;
        let maxY = this.max.y;
        const list = Array.isArray(others) ? others : [others];
        const bbox = mutate ? this : new BoundingBox();
        if (mutate) {
            this.min.apply(0, 0);
            this.max.apply(0, 0);
        }
        for (const other of list) {
            if (!other?.isBoundingBox) throw new Error(`[${typeString(this)}]: Cannot calculate overlap with type ${typeString(other)}`);
            minX = Math.max(minX, other.min.x);
            minY = Math.max(minY, other.min.y);
            maxX = Math.min(maxX, other.max.x);
            maxY = Math.min(maxY, other.max.y);
            if (minX > maxX || minY > maxY) return bbox;
        }
        bbox.min.apply(minX, minY);
        bbox.max.apply(maxX, maxY);
        return bbox;
    }
    add (other, mutate = false) {
        const bbox = mutate ? this : this.clone();
        if (other?.isBoundingBox) {
            bbox.min.x = Math.min(bbox.min.x, other.min.x);
            bbox.min.y = Math.min(bbox.min.y, other.min.y);
            bbox.max.x = Math.max(bbox.max.x, other.max.x);
            bbox.max.y = Math.max(bbox.max.y, other.max.y);
        } else if (other?.isPath) {
            bbox.merge(other.points, true);
        } else if (other?.isVector) {
            bbox.min.x = Math.min(bbox.min.x, other.x);
            bbox.min.y = Math.min(bbox.min.y, other.y);
            bbox.max.x = Math.max(bbox.max.x, other.x);
            bbox.max.y = Math.max(bbox.max.y, other.y);
        } else {
            throw new Error(`[${typeString(this)}]: Cannot combine BoundingBox with type ${typeString(other)}`);
        }
        return bbox;
    }
    apply (min = undefined, max = undefined) {
        if (min?.isBoundingBox) {
            this.min.apply(min.min);
            this.max.apply(min.max);
        } else {
            if (min) this.min.apply(min);
            if (max) this.max.apply(max);
        }
        return this; // for chaining
    }
    // deep clones by default, copies on init
    clone () { return new BoundingBox(this.min, this.max) }
    toString() {
        const { size } = this;
        return `[${typeString(this)}] < ${size.x.toFixed(2)} x ${size.y.toFixed(2)} at ${this.min.toString()} > `;
    }
    toJSON () { return [this.min.toJSON(), this.max.toJSON()] }
    draw (cursor, close = true) {
        if (close) cursor.beginPath();
        cursor.moveTo(this.min);
        cursor.lineTo(this.min.x, this.max.y);
        cursor.lineTo(this.max);
        cursor.lineTo(this.max.x, this.min.y);
        if (close) cursor.closePath();
    }

    get isBoundingBox () { return true }
    get isFlat () { return equals(this.#min.x, this.#max.x) || equals(this.#min.y, this.#max.y) }
    get extent () { return Math.hypot(this.#max.x - this.#min.x, this.#max.y - this.#min.y) }
    get extentSquared () {
        const width = this.max.x - this.min.x;
        const height = this.max.y - this.min.y;
        return (width * width) + (height * height);
    }
    get min () { return this.#min }
    get max () { return this.#max }
    get size () { return this.max.sub(this.min).abs(true) }
    get width () { return this.size.x }
    get height () { return this.size.y }
    get hash () { return Vector.hash([this.min, this.max]) }
    get center () { return this.#min.lerp(this.#max, .5) }
}