import { Shape, Vector, Color } from "../geometry/geometry.js";

// [!] can be passed safely between web workers
export class Blast { // only intended to record information, properties should be extracted before manipulating data
    #shape;
    #damage;
    #delay; // MILLISECONDS
    constructor (shape, delay = 0, damage = 0) {
        if (!shape?.isShape) throw new Error(`[${this.constructor.name}]: Invalid argument - Shape expected, got ${typeof shape}`);
        if (delay < 0) throw new Error(`[${this.constructor.name}]: Invalid argument - delay must be a non-negative numeric value, got ${delay}`);
        this.#shape = shape;
        this.#delay = delay;
        this.#damage = damage;
    }

    toJSON () {
        return {
            shape: this.shape,
            delay: this.delay,
            position: this.position,
            damage: this.damage,
            radius: this.radius
        }
    }
    decode () {
        const decoded = this.shape.decode();
        return {
            delay: this.delay,
            shape: decoded,
            damage: this.damage,
            buffers: decoded.buffers || []
        }
    }
    clone (deep = false) {
        return new Blast(this.shape.clone(deep), this.delay);
    }

    get isBlast () { return true }
    get shape () { return this.#shape }
    get damage () { return this.#damage }
    set damage (value) { return (this.#damage = value) }
    get radius () { return this.#shape.radius }
    set radius (value) { return (this.#shape.radius = value) }
    get delay () { return this.#delay }
    set delay (value) {
        if (value < 0) throw new Error(`[${this.constructor.name}]: Invalid value - delay must be a non-negative numeric value, got ${value}`);
        return (this.#delay = value);
    }
    get position () { return this.#shape.origin } // modifying this will not apply any transformations to the Shape

    static fromObject (payload) {
        const shape = Shape.fromObject(payload.shape);
        const blast = new Blast(shape, payload.delay);
        return blast;
    }
}

export function drawBlastAnimation (cursor, shape, progress) {
    const color = new Color(255, 255, 255, 1);
    color.a = 1 - (progress**2);
    cursor.save();
    cursor.fillStyle = color.toString();
    shape.draw(cursor);
    cursor.fill();
    cursor.restore();
}