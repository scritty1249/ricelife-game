import { deg2rad } from "./utils.js";

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
    clone() {
        return new Vector(this.x, this.y);
    }
    toString () {
        return `(${this.x}, ${this.y})`;
    }
    toJSON () {
        return {x: this.x, y: this.y};
    }
}

export function Direction (degrees) {
    const rad = deg2rad(degrees);
    return new Vector(Math.cos(rad), Math.sin(rad));
}