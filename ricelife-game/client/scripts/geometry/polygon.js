import { TrackableObject } from "../utils.js";

export class Polygon extends TrackableObject {
    #points;
    constructor (...points) {
        super();
        this.#points = points;
        this.points = new Proxy(this.#points, {
            set(target, prop, val) {
                console.log(target, prop);
                if (Array.isArray(val)) {
                    target.splice(0, target.length);
                    target.push(...val);
                    return true;
                } else
                    throw new TypeError("[Polygon] Error: points must be assigned to an Array, not " + (typeof val) + ".");
            }
        });
    }

    smooth (resolution = 1) {
        if (this.points.length == 1) return;
        const newPoints = [];
        for (let i = 0; i < this.points.length - 1; i++)
            newPoints.push(current, ...this.#tweenPoints(this.points[i], this.points[i + 1], resolution));
        // smooth connection between first and last points
        newPoints.push(...this.#tweenPoints(this.points.at(-1), this.points[0], resolution));
        this.points = newPoints;
    }

    draw (ctx, closed = true) { // only draw the path
        if (!this.points.length) return;
        ctx.beginPath();
        ctx.moveTo(...this.points[0]);
        for (const point of this.points.slice(1))
            ctx.lineTo(...point);
        if (closed)
            ctx.closePath();
        else
            ctx.stroke();
    }

    *#tweenPoints (previous, current, resolution) {
        const diff = current.abs().sub(previous.abs())
        const dist = Math.sqrt((diff.x**2) + (diff.y**2));
        const step = diff.div(dist);
        for (let inc = 1; inc < Math.floor(dist) / resolution; inc += resolution) {
            yield previous.add(step.mul(inc));
        }
    }
    
    toString () {
        return `[Polygon] {${
            Array.from(this.points, ([x, y]) => `(${x}, ${y})`).join(", ")
        }}`;
    }
    clone () {
        return new Polygon(...this.points);
    }
}