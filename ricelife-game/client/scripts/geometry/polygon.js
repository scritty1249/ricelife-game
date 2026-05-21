import { Path, tweenPoints } from "./path.js";
import { TrackableObject } from "../utils.js";

export class Polygon extends TrackableObject { // points should be ordered clockwise (in positioning)
    #path;
    constructor (...points) {
        super();
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
    }

    merge (poly, mutate = false) {
        const polygon = mutate ? this : this.clone();

    }

    cut (poly, mutate = false) {
        const polygon = mutate ? this : this.clone();

    }

    draw (ctx) { // only draw the path
        if (!this.#path.points.length) return;
        ctx.beginPath();
        ctx.moveTo(...this.#path.points[0]);
        for (const point of this.#path.points.slice(1))
            ctx.lineTo(...point);
        ctx.closePath();
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
            return inside;
        } else if (value?.isPath) {
            
        } else
            throw new Error("[Polygon] Error: Unable to compute intersect of unsupported type " + (typeof value));
    }

    get isPolygon () { return true }
    get path () { return this.#path }
    
    toString () {
        return `[Polygon] {${
            Array.from(...this.#path, ([x, y]) => `(${x}, ${y})`).join(", ")
        }}`;
    }
    clone () {
        return new Polygon(this.#path);
    }
}