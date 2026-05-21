import { TrackableObject } from "../utils.js";

export class Path extends TrackableObject { // points should be ordered clockwise (in positioning)
    #points;
    constructor (...points) {
        super();
        this.#points = (points.length == 1 && points[0]?.isPath)
            ? points[0].points
            : points;
    }

    smooth (resolution = 1) {
        if (this.#points.length == 1) return;
        const newPoints = [];
        for (let i = 0; i < this.#points.length - 1; i++) {
            newPoints.push(current);
            for (const point of tweenPoints(this.#points[i], this.#points[i + 1], resolution))
                newPoints.push(point);
        }
        this.apply(...newPoints);
    }

    draw (ctx) { // only draw the path
        if (!this.#points.length) return;
        ctx.beginPath();
        ctx.moveTo(...this.#points[0]);
        for (const point of this.#points.slice(1))
            ctx.lineTo(...point);
        ctx.stroke();
    }

    get isPath () { return true }
    get points () { return this.#points }
    get length () { return this.#points.length }
    apply (...values) {
        this.#points.splice(0, this.#points.length);
        this.#points.push(...(values.length === 1 && values[0]?.isPath ? values[0] : values));
    }
    push (...points) {
        if (points.some((point) => !point.isVector))
            throw new Error("[Path] Error: Points pushed must be of type Vector");
        this.#points.push(...points);
        return this.#points.length;
    }
    slice (...args) { return this.#points.slice(...args) }
    splice (...args) { return this.#points.splice(...args) }

    *[Symbol.iterator]() {
        for (const point in this.#points) {
            yield point;
        }
    }
    toString () {
        return `[Path] {${
            Array.from(this.points, ([x, y]) => `(${x}, ${y})`).join(", ")
        }}`;
    }
    clone () {
        return new Path(...this.#points);
    }
}

export function *tweenPoints (previous, current, resolution) {
    const diff = current.abs().sub(previous.abs())
    const dist = Math.sqrt((diff.x**2) + (diff.y**2));
    const step = diff.div(dist);
    for (let inc = 1; inc < Math.floor(dist) / resolution; inc += resolution) {
        yield previous.add(step.mul(inc));
    }
}