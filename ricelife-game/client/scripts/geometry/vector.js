import { deg2rad } from "../utils.js";

export class Vector {
    constructor(x = 0, y = null) {
        this.apply(x, y);
    }
    // arithmetic operations
    add (value, mutate = false) {
        const [newX, newY] = Number.isFinite(value)
            ? [this.x + value, this.y + value]
            : [this.x + value.x, this.y + value.y];
        return mutate
            ? (this.x = newX, this.y = newY, this)
            : new Vector(newX, newY);
    }
    sub (value, mutate = false) {
        const [newX, newY] = Number.isFinite(value)
            ? [this.x - value, this.y - value]
            : [this.x - value.x, this.y - value.y];
        return mutate
            ? (this.x = newX, this.y = newY, this)
            : new Vector(newX, newY);
    }
    div (value, mutate = false) {
        const [newX, newY] = Number.isFinite(value)
            ? [this.x / value, this.y / value]
            : [this.x / value.x, this.y / value.y];
        return mutate
            ? (this.x = newX, this.y = newY, this)
            : new Vector(newX, newY);
    }
    mul (value, mutate = false) {
        const [newX, newY] = Number.isFinite(value)
            ? [this.x * value, this.y * value]
            : [this.x * value.x, this.y * value.y];
        return mutate
            ? (this.x = newX, this.y = newY, this)
            : new Vector(newX, newY);
    }
    pow (value = 2, mutate = false) {
        const [newX, newY] = Number.isFinite(value)
            ? [Math.pow(this.x, value), Math.pow(this.y, value)]
            : [Math.pow(this.x, value.x), Math.pow(this.y, value.y)];
        return mutate
            ? (this.x = newX, this.y = newY, this)
            : new Vector(newX, newY);
    }
    mod (value, mutate = false) {
        const [newX, newY] = Number.isFinite(value)
            ? [this.x % value, this.y % value]
            : [this.x % value.x, this.y % value.y];
        return mutate
            ? (this.x = newX, this.y = newY, this)
            : new Vector(newX, newY);
    }
    abs (mutate = false) {
        if (mutate) {
            this.x = Math.abs(this.x);
            this.y = Math.abs(this.y);
            return this;
        } else {
            return new Vector(
                Math.abs(this.x),
                Math.abs(this.y)
            );
        }
    }
    transpose (mutate = false) {
        if (mutate) {
            const x = this.x;
            this.x = this.y;
            this.y = x;
            return this;
        } else {
            return new Vector(this.y, this.x);
        }
    }
    project (radians, magnitude, mutate = false) {
        const [dx, dy] = [magnitude * Math.cos(radians), magnitude * Math.sin(radians)];
        if (mutate) {
            this.x += dx;
            this.y += dy;
            return this;
        } else {
            return new Vector(this.x + dx, this.y + dy);
        }
    }
    sum () {
        return this.x + this.y;
    }
    diff () {
        return this.x - this.y;
    }
    prod () {
        return this.x * this.y;
    }
    magnitude () {
        return Math.sqrt(this.pow(2).sum());
    }
    angle (...vectors) {
        let sumCos = 0, sumSin = 0;
        for (const vector of vectors) {
            if (!vector?.isVector)
                throw new Error("[Vector] Error: Cannot calculate angle from non-Vector type " + (typeof vector));
            const angle = Math.atan2(...vector.sub(this));
            sumCos += Math.cos(angle);
            sumSin += Math.sin(angle);
        }
        return Math.atan2(sumSin, sumCos);
    }
    eq (vector) {
        return vector.isVector && this.x == vector.x && this.y == vector.y;
    }
    apply (x, y = null) {
        if (Number.isFinite(x)) {
            if (y === null) {
                this.x = x;
                this.y = x;
            } else {
                this.x = x;
                this.y = y;
            }
        } else {
            this.x = x.x;
            this.y = x.y;
        }
    }
    // overload / basic operations
    *[Symbol.iterator]() {
        yield this.x;
        yield this.y;
    }
    get isVector () { return true }
    clone () { return new Vector(this.x, this.y) }
    toString () { return `(${this.x}, ${this.y})` }
    toJSON () { return {x: this.x, y: this.y} }
}

export class Color {
    #hexPattern = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})?$/;
    constructor (value, g = undefined, b = undefined, a = 255) {
        let matches, _;
        if (typeof value === "string"
            && (matches = value.match(this.#hexPattern)))
            [_, this.r, this.g, this.b, this.a] = Array.from(matches, (match) => parseInt(match, 16));
        else if (Object.hasOwn(value, "r")
            && Object.hasOwn(value, "g")
            && Object.hasOwn(value, "b"))
            ({r: this.r, g: this.g, b: this.b, a: this.a} = value);
        else if (b !== undefined)
            [this.r, this.g, this.b, this.a] = value, g, b, a;
        else
            throw new Error("[Color] Error: Invalid argument at declaration");
        if (!Number.isFinite(this.a))
            this.a = 255
    }
    toJSON () { return {r: this.r, g: this.g, b: this.b, a: this.a} }
    toString () { return "#"
        + this.r.toString(16).padStart(2, "0")
        + this.g.toString(16).padStart(2, "0")
        + this.b.toString(16).padStart(2, "0")
        + (this.a < 255 ? this.a.toString(16).padStart(2, "0") : "");
    }
}

export function Direction (degrees) {
    const rad = deg2rad(degrees);
    return new Vector(Math.cos(rad), Math.sin(rad));
}

