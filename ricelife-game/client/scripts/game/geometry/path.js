import { TrackableObject, clamp, floatEqual } from "../utils/utils.js";
import { Vector } from "./vector.js";

export class Path extends TrackableObject { // points should be ordered clockwise (in positioning)
    #points;
    #isClosed = false;
    constructor (...points) {
        super();
        this.#points = (points.length == 1)
            ? points[0]?.isPath
                ? points[0].points
                : Array.isArray(points[0])
                    ? [...points[0]]
                    : [points[0]]
            :   [...points];
    }

    // removes duplicate adjacent points from Path
    reduce (mutate = false) {
        const path = mutate ? this : this.clone(true);
        if (path.length <= 1) return path;
        const newPoints = [];
        const points = path.points;
        for (let i = 0; i < points.length - 1; i++) {
            if (!points[i].eq(points[i+1])) newPoints.push(points[i]);
        }
        if (path.isClosed && !path.at(-1).eq(path.at(0)))
            newPoints.push(path.at(-1));
        else
            newPoints.push(points.at(-1));
        path.splice(0, path.length);
        for (const point of newPoints) path.push(point);
        return path;
    }
    subsection (resolution = 1) {
        if (this.length == 1) return;
        const newPoints = [];
        for (let i = 0; i < this.length - 1; i++) {
            newPoints.push(this.#points[i]);
            for (const point of tweenPoints(this.#points[i], this.#points[i + 1], resolution))
                newPoints.push(point);
        }
        this.apply(...newPoints);
        return this; // for chaining
    }
    // round off edges/turns that exceed a given angle (radians)
    smooth (maxAngle = Math.PI / 4, mutate = false) {
        const path = mutate ? this : this.clone(true);
        const pts = path.points;
        if (pts.length < 3) return path;
        const newPoints = [];
        const startIdx = path.isClosed ? 0 : 1;
        const endIdx = path.isClosed ? pts.length : pts.length - 1;

        if (!path.isClosed) newPoints.push(pts[0]);
        for (let i = startIdx; i < endIdx; i++) {
            const prev = pts[(i - 1 + pts.length) % pts.length];
            const curr = pts[i % pts.length];
            const next = pts[(i + 1) % pts.length];

            if (floatEqual(prev.distance(curr), 0)
                || floatEqual(curr.distance(next), 0)
            ) {
                // overlapping point, skip
                newPoints.push(curr);
                continue;
            }
            const dotProd = curr
                .sub(prev)
                .normalize(true)
                .dot(next
                    .sub(curr)
                    .normalize(true));
            const segmentAngle = Math.acos(Math.max(-1, Math.min(1, dotProd)));

            if (segmentAngle > maxAngle) {
                // smoothing
                const q = curr.lerp(prev, 0.25);
                const r = curr.lerp(next, 0.25);
                newPoints.push(q, r);
            } else {
                // keep the same
                newPoints.push(curr);
            }
        }
        if (!path.isClosed) newPoints.push(pts[pts.length - 1]);
        path.splice(0, path.length);
        for (const pt of newPoints) path.push(pt);
        return path;
    }
    draw (cursor, close = true) { // only draw the path
        if (!this.#points.length) return;
        if (close) cursor.beginPath();
        cursor.moveTo(this.#points[0]);
        for (const point of this.#points.slice(1))
            cursor.lineTo(point);
        if (close) cursor.stroke();
    }
    *lines () { // returns pairs of Vectors as Paths
        if (this.length <= 1) return;
        for (let i = 1; i < this.length; i++)
            yield new Path(this.slice(i-1, i+1));
    }
    normal () { // gets the accumulated normal vector of all points
        const points = this.points;
        const clockwise = this.isClockwise;
        if (points.length < 2) throw new Error(`[${this.constructor.name}]: Cannot calculate normal of less than 2 Vectors`);
        const sumVectors = points.slice(1).reduce((acc, curr, i) => acc.add(points[i].normal(curr, clockwise).normalize()), new Vector());
        return sumVectors.normalize();
    }
    // accepts: (Vector), (Vector, Vector) or Path
    isIntersecting (start, end = null) {
        const { points } = this;
        if (points.length === 0) return false;
        if (start?.isPath) {
            const pts = start.points;
            for (let i = 0; i < pts.length; i+=2)
                if (this.isIntersecting(pts[i], pts[i+1])) return true;
            return false;
        } else if (start?.isVector && end?.isVector) {
            if (points.length === 1) return Vector.isBetween(points[0], start, end);
            for (let i = 0; i < points.length; i+=2)
                if (Vector.segmentsIntersect(points[i], points[i+1], start, end)) return true;
            return this.isClosed && Vector.segmentsIntersect(points.at(-1), points[0], start, end);
        } else if (start?.isVector) {
            if (points.length === 1) return points[0].eq(start);
            for (let i = 0; i < points.length; i+=2) {
                const pt1 = points[i];
                const pt2 = points[i+1];
                if (Vector.isBetween(start, pt1, pt2))
                    return {
                        point: start.clone(),
                        angle: pt1.angle(start),
                        coeff: pt1.distance(start) / pt1.distance(pt2),
                        index: i
                    };
            }
            if (this.isClosed && Vector.isBetween(start, points.at(-1), points[0]))
                return {
                    point: start.clone(),
                    angle: points.at(-1).angle(start),
                    coeff: points.at(-1).distance(start) / points.at(-1).distance(points[0]),
                    index: points.length - 1
                };
            return false;
        }
        throw new Error(`[${this.constructor.name}]: Invalid argument(s), cannot check intersection of Path and ${typeof start}${end === null ? "" : `, ${typeof end}`}`);
    }
    intersections (path) { // returns the CLOCKWISE details of all intersections from this Path to the given Path ("this" points into "that"). !! This can return points that are not inside of the Path, if the resolution is large enough!
        if (!path?.isPath) throw new Error(`[${this.constructor.name}] Error: Cannot find intersection with non-Path object ${typeof path}`);
        const intersections = [],
            thisPts = this.points,
            thatPts = path.points;
        // idiot check
        if (thisPts.length === 0 || thatPts.length === 0)
            return [];
        else if (thisPts.length === 1 && thatPts.length === 1)
            return thisPts[0].eq(thatPts[0])
                ? [{
                    point: thisPts.clone(),
                    entering: undefined,
                    index: { self: 0, other: 0 },
                    coeff: { self: 0, other: 0 },
                    angle: 0 // [!] maybe this should be undefined? but would add lot of overhead to anything using this method -KT
                }] : [];
        else if (thisPts.length === 1) {
            const inter = path.isIntersecting(thisPts[0]);
            if (inter) { // inter should always be an Object when truthy, since we passed a Vector to isIntersecting
                const otherIdx = inter.index;
                inter.index = { self: 0, other: otherIdx };
                const otherCoeff = inter.coeff;
                inter.coeff = { self: 0, other: otherCoeff };
                inter.entering = undefined;
                return [inter];
            }
            return [];
        } else if (thatPts.length === 1) {
            const inter = this.isIntersecting(thatPts[0]);
            if (inter) { // inter should always be an Object when truthy, since we passed a Vector to isIntersecting
                const selfIdx = inter.index;
                inter.index = { self: selfIdx, other: 0 };
                const selfCoeff = inter.coeff;
                inter.coeff = { self: selfCoeff, other: 0 };
                inter.entering = undefined;
                return [inter];
            }
            return [];
        }
        // this segements
        const thisSegmentCount = this.isClosed ? thisPts.length : thisPts.length - 1; 
        const thatSegmentCount = path.isClosed ? thatPts.length : thatPts.length - 1;
        for (let i = 0; i < thisSegmentCount; i++) {
            const thisStart = thisPts[i];
            const thisEnd = thisPts[(i + 1) % thisPts.length];
            const direction = thisEnd.sub(thisStart); 
            // that segments
            for (let j = 0; j < thatSegmentCount; j++) {
                const thatStart = thatPts[j];
                const thatEnd = thatPts[(j + 1) % thatPts.length];
                const inwardNormal = thatStart.normal(thatEnd);
                const isEntering = direction.dot(inwardNormal) > 0;
                if (thisStart.eq(thatStart)) {
                    if (!intersections.some(inter => inter.point.eq(thisStart))) {
                        const dir = thatEnd.sub(pOtherStart);
                        intersections.push({
                            point: thisStart.clone(),
                            entering: isEntering,
                            index: { self: i, other: j },
                            coeff: { self: 0, other: 0 },
                            angle: Math.atan2(direction.cross(dir), direction.dot(dir))
                        });
                    }
                    continue;
                }
                const dir = thatEnd.sub(thatStart),
                    cross = direction.cross(dir),
                    gap = thatStart.sub(thisStart);
                // skip segment if lines are parallel (cross product zero)
                if (Math.abs(cross) < Number.EPSILON) continue;
                const thisDistCoeff = gap.cross(dir) / cross,
                    thatDistCoeff = gap.cross(direction) / cross;
                // sanity check: are we still within the segment's range?
                if (thisDistCoeff >= -Number.EPSILON
                    && thisDistCoeff <= 1 + Number.EPSILON
                    && thatDistCoeff >= -Number.EPSILON
                    && thatDistCoeff <= 1 + Number.EPSILON
                ) {
                    intersections.push({
                        point: thisPts[i].add(direction.mul(clamp(thisDistCoeff, 0, 1))),
                        entering: isEntering,
                        index: { self: i, other: j },
                        coeff: { // percentage of segment distance covered
                            self: thisDistCoeff,
                            other: thatDistCoeff
                        },
                        angle: Math.atan2(cross, direction.dot(dir)) // radians
                    });
                }
            }
        }
        if (intersections.length === 0) return [];
        intersections.sort((a, b) => (a.index.self !== b.index.self) ? a.index.self - b.index.self : a.coeff.self - b.coeff.self); // sort intersections along "this" path
        let i = 0;
        while (intersections.length > 0 && !intersections[0].entering && i < intersections.length) {
            intersections.push(intersections.shift());
            i++;
        }
        return intersections;
    }
    *clip (bbox, reference = false) {
        if (!bbox?.isBoundingBox) throw new Error(`[${this.constructor.name}]: Cannot clip from type ${typeof bbox}`);
        const pts = this.points;
        if (!pts.length) return;
        let segment = bbox.isIntersecting(pts[0])
            ? new Path(reference ? pts[0] : pts[0].clone())
            : undefined;
        const length = false ? pts.length : pts.length - 1;
        for (let i = 0; i < length; i++) {
            const start = pts[i];
            const end = pts[(i + 1) % pts.length];
            const endsInside = bbox.isIntersecting(end);
            if (bbox.isIntersecting(start) !== endsInside) {
                const cut = bbox.getIntersection(start, end);
                if (cut)
                    if (segment) {
                        segment.push(cut);
                        if (segment.length) yield segment;
                        segment = undefined;
                    } else segment = new Path(cut);
            }
            if (endsInside) {
                if (!segment) segment = new Path();
                segment.push(reference ? end : end.clone());
            }
        }
        if (segment) {
            if (segment.points.length === pts.length)
                segment.isClosed = this.isClosed;
            yield segment;
        }
    }

    get isPath () { return true }
    get isClosed () { return this.#isClosed }
    set isClosed (bool) { return (this.#isClosed = bool) }
    get points () { return this.#points }
    get length () { return this.#points.length }
    get direction () { return this.#points.slice().reverse().reduce((acc, curr) => acc.sub(curr)) }
    get angle () { return (this.length > 1) ? this.#points[0].angle(...this.slice(1)) : undefined }
    get pointNodes () { // [!] probably should just be applying this as we push in new points... but not sure if that's what I want the Path class to do natively.
        return this.map((pt, idx, arr) => ({
            point: pt,
            nextNode: arr.at((idx + 1) % arr.length),
            prevNode: arr.at((idx - 1) % arr.length)
        }));
    }
    get hash () {
        // just hashes points, does not account for Path attributes (like ID)
        return Vector.hashVectors(this.points);
    }
    Float64 () {
        const arr = [];
        for (let i = 0; i < this.length; i++)
            arr.push(...this.at(i));
        return new Float64Array(arr);
    }
    get isClockwise () { // "Shoelace formula"
        if (this.length < 3) return true;
        return this.points.reduce((acc, p1, i) => {
            const p2 = this.points[(i + 1) % this.length];
            return acc + (p2.x - p1.x) * (p2.y + p1.y);
        }, 0) > 0;
    }

    apply (...values) {
        this.#points.splice(0, this.#points.length);
        this.#points.push(...(values.length == 1 && values[0]?.isPath ? values[0] : values));
    }
    map (...args) {
        return this.#points.map(...args);
    }
    forEach (...args) { this.#points.forEach(...args) }
    push (...points) {
        for (const pt of points)
            if (!pt?.isVector) throw new Error(`[${this.constructor.name}] Error: Points pushed must be of type Vector, not ${typeof pt}`);
        this.#points.push(...points);
        return this.length;
    }
    translate (vector, mutate = false) {
        const path = mutate ? this : this.clone(true);
        path.points.forEach((point) => point.add(vector, true));
        return path;
    }
    slice (...args) { return this.points.slice(...args) }
    splice (...args) { return this.points.splice(...args) }
    at (...args) { return this.points.at(...args) }
    reduce (...args) { return this.points.reduce(...args) }
    nearestTo (point) {
        if (!point?.isVector) throw new Error(`[${this.constructor.name}] Error: Point must Vector type, not ${typeof point}`);
        return this.points.reduce((acc, curr) => curr.distance(point) < acc.distance(point) ? curr : acc);
    }
    round (precision) { this.map((point) => point.round(precision, true)) }
    eq (path) {
        if (!path?.isPath || path.length !== this.length) return false;
        for (let i = 0; i < this.length; i++)
            if (!this.at(i).eq(path.at(i))) return false;
        return true;
    }
    *[Symbol.iterator]() {
        yield* this.#points;
    }
    toString () {
        return `[Path] <${this.#points.map((pt) => pt.toString()).join(", ")}>`;
    }
    clone (deep = false) {
        const path = deep
            ? new Path(...this.#points.map((pt) => pt.clone()))
            : new Path(...this.#points);
        path.isClosed = this.isClosed;
        return path;
    }
    static fromArray (arr) {
        if (arr.length % 2 === 1) throw new Error(`[${this.constructor.name}] Error: Cannot initalize new Path from uneven array of length ${arr.length.toString()}`);
        const path = new Path();
        for (let i = 0; i < arr.length; i+=2)
            path.push(new Vector(arr[i], arr[i+1]));
        return path;
    }
    static intersectAngle (p0, p1, p2, p3) { // lightweight version of interections method
        const d0 = p1.sub(p0),
            d1 = p3.sub(p2),
            cross = d0.cross(d1),
            dot = d0.dot(d1);
        return {
            angle: Math.atan2(cross, dot),
            entering: cross > 0
        };
    }
}

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
            if (!other?.isBoundingBox) throw new Error(`[${this.constructor.name}]: Cannot calculate overlap with type ${typeof other}`);
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
            throw new Error(`[${this.constructor.name}]: Cannot combine BoundingBox with type ${typeof other}`);
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
        return `[${this.constructor.name}] < ${size.x.toFixed(2)} x ${size.y.toFixed(2)} at ${this.min.toString()} > `;
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
    get isFlat () { return floatEqual(this.#min.x, this.#max.x) || floatEqual(this.#min.y, this.#max.y) }
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
    get hash () { return Vector.hashVectors([this.min, this.max]) }
    get center () { return this.#min.lerp(this.#max, .5) }
}

export function *tweenPoints (previous, current, resolution) {
    const diff = current.sub(previous),
        dist = Math.hypot(...diff);
    if (dist === 0) return; 
    const step = diff.div(dist);
    for (let inc = resolution; inc < dist; inc += resolution) {
        yield previous.add(step.mul(inc));
    }
}

export class Ray extends Path {
    constructor (origin, direction, distance = undefined) {
        if (distance === undefined) super(origin, direction);
        else super(origin, origin.add(direction.mul(distance)));
    }

    get isRay () { return true }
}
