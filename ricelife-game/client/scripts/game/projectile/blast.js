import { Circle, Vector } from "../geometry/geometry.js";

// [!] can be passed safely between web workers
export class Blast { // only intended to record information, properties should be extracted before manipulating data
    #shape;
    #delay; // MILLISECONDS
    constructor (shape, delay = 0) {
        if (!shape?.isCircle) throw new Error(`[${this.constructor.name}]: Invalid argument - Circle expected, got ${typeof shape}`);
        if (delay < 0) throw new Error(`[${this.constructor.name}]: Invalid argument - delay must be a non-negative numeric value, got ${delay}`);
        this.#shape = shape;
        this.#delay = delay;
    }

    toJSON () {
        return {
            shape: this.shape,
            delay: this.delay,
            position: this.position,
            radius: this.radius
        }
    }
    decode () {
        return {
            delay: this.delay,
            position: this.shape.position.toJSON(),
            radius: this.shape.radius,
            resolution: this.shape.resolution
        }
    }
    clone (deep = false) {
        return new Blast(this.shape.clone(deep), this.delay);
    }

    get isBlast () { return true }
    get shape () { return this.#shape }
    get radius () { return this.#shape.radius }
    set radius (value) { return (this.#shape.radius = value) }
    get delay () { return this.#delay }
    set delay (value) {
        if (value < 0) throw new Error(`[${this.constructor.name}]: Invalid value - delay must be a non-negative numeric value, got ${value}`);
        return (this.#delay = value);
    }
    get position () { return this.#shape.position }

    static fromObject (payload) {
        const shape = new Circle(Vector.fromObject(payload.position), payload.radius, payload.resolution);
        const blast = new Blast(shape, payload.delay);
        return blast;
    }
}