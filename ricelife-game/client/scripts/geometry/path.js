import { TrackableObject, clamp } from "../utils/utils.js";
import { Vector } from "./vector.js";

export class Path extends TrackableObject { // points should be ordered clockwise (in positioning)
    #points;
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

    smooth (resolution = 1) {
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

    draw (ctx, close = true) { // only draw the path
        if (!this.#points.length) return;
        if (close) ctx.beginPath();
        ctx.moveTo(...this.#points[0]);
        for (const point of this.#points.slice(1))
            ctx.lineTo(...point);
        if (close) ctx.stroke();
    }

    *lines () { // returns pairs of Vectors as Paths
        if (this.length <= 1) return;
        for (let i = 1; i < this.length; i++)
            yield new Path(this.slice(i-1, i+1));
    }

    intersections (path) { // returns the CLOCKWISE details of all intersections from this Path to the given Path ("this" points into "that"). !! This can return points that are not inside of the Path, if the resolution is large enough!
        if (!path?.isPath) throw new Error("[Path] Error: Cannot find intersection with non-Path object " + (typeof path));
        const intersections = [],
            thisPts = this.points,
            thatPts = path.points;

        // this segements
        for (let i = 0; i < thisPts.length; i++) {
            const direction = thisPts[(i + 1) % thisPts.length].sub(thisPts[i]);
            // that segments
            for (let j = 0; j < thatPts.length; j++) {
                const dir = thatPts[(j + 1) % thatPts.length].sub(thatPts[j]),
                    cross = direction.cross(dir),
                    gap = thatPts[j].sub(thisPts[i]);

                // skip segment if lines are parallel (cross product zero)
                if (Math.abs(cross) < Number.EPSILON) continue;
                const thisDistCoefficient = gap.cross(dir) / cross,
                    thatDistCoefficient = gap.cross(direction) / cross;
                // sanity check: are we still within the segment's range?
                if (thisDistCoefficient >= -Number.EPSILON
                    && thisDistCoefficient <= 1 + Number.EPSILON
                    && thatDistCoefficient >= -Number.EPSILON
                    && thatDistCoefficient <= 1 + Number.EPSILON
                ) {
                    intersections.push({
                        point: thisPts[i].add(direction.mul(clamp(thisDistCoefficient, 0, 1))),
                        entering: cross > 0,
                        index: {
                            self: i,
                            other: j
                        },
                        coeff: { // percentage of segment distance covered
                            self: thisDistCoefficient,
                            other: thatDistCoefficient
                        },
                        angle: Math.atan2(cross, direction.dot(dir)) // radians
                    });
                }
            }
        }
        if (intersections.length === 0) return [];
        intersections.sort((a, b) => (a.index.self !== b.index.self) ? a.index.self - b.index.self : a.coeff.self - b.coeff.self);         // sort intersections along "this" path
        let i = 0;
        while (intersections.length > 0 && !intersections[0].entering && i < intersections.length) {
            intersections.push(intersections.shift());
            i++;
        }
        return intersections;
    }

    get isPath () { return true }
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
    push (...points) {
        for (const pt of points)
            if (!pt?.isVector) throw new Error("[Path] Error: Points pushed must be of type Vector, not " + (typeof pt));
        this.#points.push(...points);
        return this.length;
    }
    translate (vector, mutate = false) { const path = mutate ? this : this.clone(); path.points.forEach((point) => point.add(vector)); return path; }
    slice (...args) { return this.points.slice(...args) }
    splice (...args) { return this.points.splice(...args) }
    at (...args) { return this.points.at(...args) }
    nearestTo (point) {
        if (!point?.isVector) throw new Error("[Path] Error: Point must Vector type, not " + (typeof point));
        return this.points.reduce((acc, curr) => curr.distance(point) < acc.distance(point) ? curr : acc);
    }
    round (precision) { this.map((point) => point.round(precision, true)) }

    *[Symbol.iterator]() {
        yield* this.#points;
    }
    toString () {
        return `[Path] <${this.#points.map((pt) => pt.toString()).join(", ")}>`;
    }
    clone () {
        return new Path(...this.#points);
    }
    static fromArray (arr) {
        if (arr.length % 2 === 1) throw new Error("[Path] Error: Cannot initalize new Path from uneven array of length " + arr.length.toString());
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

export function *tweenPoints (previous, current, resolution) {
    const diff = current.sub(previous),
        dist = Math.hypot(...diff);
    if (dist === 0) return; 
    const step = diff.div(dist);
    for (let inc = resolution; inc < dist; inc += resolution) {
        yield previous.add(step.mul(inc));
    }
}

export function Ray (origin, direction, distance) {
    return new Path(origin, origin.add(direction.mul(distance)));
}