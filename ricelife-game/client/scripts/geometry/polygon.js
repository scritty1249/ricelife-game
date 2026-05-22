import { Path, tweenPoints } from "./path.js";
import { TrackableObject } from "../utils.js";

export class Polygon extends TrackableObject { // points should be ordered clockwise (in positioning)
    #path;
    constructor (...points) {
        super();
        this.holes = []; // hole paths must be reordered to counter clockwise positioning
        this.#path = (points.length == 1 && points[0]?.isPath)
            ? points[0]
            : new Path(...points);
    }

    smooth (resolution = 1) {
        if (this.#path.points.length == 1) return;
        this.#path.smooth(resolution);
        // smooth connection between first and last points
        for (const point of tweenPoints(this.#path.points.at(-1), this.#path.points[0], resolution))
            this.#path.push(point);
        for (const hole of this.holes)
            hole.smooth(resolution);
    }

    merge (poly, mutate = false) {
        const polygon = mutate ? this : this.clone();
        
    }

    cut (poly) {
        if (!poly?.isPolygon) {
            throw new Error("[Polygon] Error: Cannot cut with non-Polygon type");
        }
        this.holes.push(poly);
        return this; // for chaining
    }

    draw (ctx, close = true) { // only draw the path
        if (!this.#path.points.length) return;
        if (close) ctx.beginPath();
        ctx.moveTo(...this.#path.points[0]);
        for (let i = 1; i < this.#path.points.length; i++)
            ctx.lineTo(...this.#path.points[i]);
        if (close) ctx.closePath();
    }

    isIntersecting (value) {
        if (value?.isVector) {
            let inside = false;
            const { x, y } = value;
            const len = this.#path.length;
            for (let i = 0, j = len - 1; i < len; j = i++) {
                const pi = this.#path.points[i];
                const pj = this.#path.points[j];
                const intersect = ((pi.y > y) !== (pj.y > y))
                    && (x < (pj.x - pi.x) * (y - pi.y) / (pj.y - pi.y) + pi.x);
                if (intersect) inside = !inside;
            }
            return inside && !this.holes.some((hole) => hole.isIntersecting(value));
        } else if (value?.isPolygon) {
            return value.path.points.some((point) => this.isIntersecting(point));
        } else if (value?.isPath) { // counts surface contact/collision as intersection
            return value.points.some((point) => this.isIntersecting(point));
        } else
            throw new Error("[Polygon] Error: Unable to compute intersect of unsupported type " + (typeof value));
    }

    get isPolygon () { return true }
    get path () { return this.#path }
    
    toString () {
        return `[Polygon] {${
            Array.from([...this.#path], (pt) => pt.toString()).join(", ")
        }}`;
    }
    clone () {
        return new Polygon(this.#path);
    }
}
