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
            this.#path.points.push(point);
        this.#path.points = newPoints;
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