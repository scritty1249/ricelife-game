import { deg2rad, floatEqual, roundTo, clamp, HASH_BASE } from "../utils/utils.js";

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
    normal (vector, clockwise = true) { // finds normalized point perpendicular to the line 
        if (!vector.isVector) throw new Error(`[${this.constructor.name}] Error: Cannot calculate normal from Vector to non-Vector type ${typeof vector}`);
        const diff = vector.sub(this);
        diff.div(diff.length, true);
        return clockwise
            ? new Vector(diff.y, -diff.x)
            : new Vector(-diff.y, diff.x);
    }
    transpose (mutate = false) {
        const vec = mutate ? this : this.clone();
        const x = vec.x;
        vec.x = vec.y;
        vec.y = x;
        return vec;
    }
    // moves Vector by distance at specified angle
    project (radians, distance, mutate = false) {
        const [dx, dy] = [distance * Math.cos(radians), distance * Math.sin(radians)];
        if (mutate) {
            this.x += dx;
            this.y += dy;
            return this;
        } else {
            return new Vector(this.x + dx, this.y + dy);
        }
    }
    round (precision, mutate = false) {
        const vec = mutate ? this : this.clone();
        vec.x = roundTo(vec.x, precision);
        vec.y = roundTo(vec.y, precision);
        return vec;
    }
    floor (mutate = false) {
        const vec = mutate ? this : this.clone();
        vec.x = Math.floor(vec.x);
        vec.y = Math.floor(vec.y);
        return vec;
    }
    precision (precision, mutate = false) {
        const vec = mutate ? this : this.clone();
        const power = 10**precision;
        return vec.mul(power, true).floor(true).div(power, true);
    }
    lerp (vector, factor) { // (Linear Interpolation) returns the point between this vector and given vector. distance from this vector determined by factor given
        if (!vector?.isVector) throw new Error(`[${this.constructor.name}] Error: Cannot linearly interpolate between Vector and non-Vector type ${typeof vector}`);
        return this.add(vector.sub(this).mul(factor));
    }
    sum () {
        return this.x + this.y;
    }
    diff (reverse = false) {
        return reverse
            ? this.y - this.x
            : this.x - this.y;
    }
    prod () {
        return this.x * this.y;
    }
    quot (reverse = false) {
        return reverse
            ? this.y / this.x
            : this.x / this.y;
    }
    modulo (reverse = false) {
        if (this.x === 0 && this.y === 0) return 0; // guard against Javascript bug (0 % 0 == NaN)
        return reverse
            ? this.y % this.x
            : this.x % this.y;
    }
    max () { return Math.max(this.x, this.y) }
    min () { return Math.min(this.x, this.y) }
    rotate (radians, mutate = false) {
        const vec = mutate ? this : this.clone();
        const angle = radians?.isVector
            ? radians.clone()
            : Vector.fromAngle(radians);
        if (floatEqual(angle.x, 0) && floatEqual(angle.y, 0)) return vec; // no rotation
        const x = vec.mul(angle).diff();
        const y = vec.mul(angle.transpose()).sum();
        return vec.apply(x, y);
    }
    pivot (radians, origin, mutate = false) {
        const vec = mutate ? this : this.clone();
        return vec.sub(origin, true).rotate(radians, true).add(origin, true);
    }
    distance (vector) {
        if (!vector?.isVector) throw new Error(`[${this.constructor.name}] Error: Cannot calculate distance between Vector and non-Vector type ${typeof vector}`);
        return Math.hypot(vector.x - this.x, vector.y - this.y);
    }
    dot (vector) { // dot product
        if (!vector?.isVector) throw new Error(`[${this.constructor.name}] Error: Cannot calculate dot product of Vector and non-Vector type ${typeof vector}`);
        return this.mul(vector).sum();
    }
    cross (vector) { // cross product
        if (!vector?.isVector) throw new Error(`[${this.constructor.name}] Error: Cannot calculate cross product of Vector and non-Vector type ${typeof vector}`);
        return (this.x * vector.y) - (vector.x * this.y);

    }
    angle (...vectors) { // returns average angle between all given vectors, from this vector (in radians)
        if (vectors.length === 0) { // return angle of self
            return Math.atan2(this.y, this.x); 
        } else if (vectors.length === 1) {
            const vector = vectors[0].sub(this);
            return Math.atan2(vector.y, vector.x);
        } else {
            let sumCos = 0, sumSin = 0;
            for (const vector of vectors) {
                if (!vector?.isVector) throw new Error(`[${this.constructor.name}] Error: Cannot calculate angle from non-Vector type ${typeof vector}`);
                const diff = vector.sub(this);
                const angle = Math.atan2(diff.y, diff.x);
                sumCos += Math.cos(angle);
                sumSin += Math.sin(angle);
            }
            return Math.atan2(sumSin, sumCos);
        }
    }
    eq (vector) {
        return vector?.isVector && floatEqual(this.x, vector.x) && floatEqual(this.y, vector.y);
    }
    apply (x, y = null) {
        if (x?.isVector) {
            this.x = x.x;
            this.y = x.y;
        } else if (y === null) { // set to scalar
            this.x = x;
            this.y = x;
        } else {
            this.x = x;
            this.y = y;
        }
        return this; // for chaining
    }
    normalize (mutate = false) {
        const vec = mutate ? this : this.clone();
        const mag = vec.length;
        vec.x /= mag;
        vec.y /= mag;
        return vec;
    }
    // overload / basic operations
    *[Symbol.iterator]() {
        yield this.x;
        yield this.y;
    }
    get isVector () { return true }
    get isNormalized () { return floatEqual(this.length, 1) }
    get hash () {
        // FNV-1a hash algorithm, just need uniqueness and speed
        let hash = HASH_BASE;
        hash ^= this.x;
        hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
        hash ^= this.y;
        hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
        return hash >>> 0; // unsigned 32-bit Integer
    }
    get length () { return Math.sqrt(this.pow(2).sum()) }
    clone () { return new Vector(this.x, this.y) }
    toString () { return `(${this.x.toFixed(3)}, ${this.y.toFixed(3)})` }
    toJSON () { return {x: this.x, y: this.y} }
    static fromObject (object) { return new Vector(object?.x, object?.y) }
    static fromAngle (radians) { return new Vector(Math.cos(radians), Math.sin(radians)) }
    static average (vectors = []) {
        if (!vectors.every((vec) => vec.isVector)) throw new Error(`[${this.constructor.name}]: Cannot find Vector average with non-Vector type(s)`);
        const vec = new Vector();
        for (const vector of vectors)
            vec.add(vector, true);
        vec.div(vectors.length, true);
        return vec;
    }
    static segmentsIntersect (start1, end1, start2, end2) {
        const denom = (end2.y - start2.y) * (end1.x - start1.x) - (end2.x - start2.x) * (end1.y - start1.y);
        if (denom === 0) return false; // parallel lines
        const ua = ((end2.x - start2.x) * (start1.y - start2.y) - (end2.y - start2.y) * (start1.x - start2.x)) / denom;
        const ub = ((end1.x - start1.x) * (start1.y - start2.y) - (end1.y - start1.y) * (start1.x - start2.x)) / denom;
        return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
    }
    static isBetween (target, start, end) {
        return start.cross(target) >= 0
            && target.cross(end) >= 0;
    }
    static mixedHash (vec1, vec2) {
        // mixes (combines) the hashes of two vectors
        let hash = HASH_BASE;
        hash ^= vec1.hash;
        hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
        hash ^= vec2.hash;
        hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
        return hash >>> 0;
    }
}

export class Color {
    static #hexPattern = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})?$/;
    #r;
    #g;
    #b;
    #a;
    constructor (value, g = undefined, b = undefined, a = 1) {
        this.apply(value, g, b, a);
    }

    apply (value, g = undefined, b = undefined, a = 1) {
        let matches, _;
        if (typeof value === "string"
            && (matches = value.match(Color.#hexPattern)))
            [_, this.r, this.g, this.b, this.a] = Array.from(matches, (match) => parseInt(match, 16));
        else if (Object.hasOwn(value, "r")
            && Object.hasOwn(value, "g")
            && Object.hasOwn(value, "b"))
            ({r: this.r, g: this.g, b: this.b, a: this.a} = value);
        else if (b !== undefined)
            [this.r, this.g, this.b, this.a] = [value, g, b, a];
        else
            throw new Error(`[${this.constructor.name}] Error: Cannot apply invalid type`);
        if (!Number.isFinite(this.a))
            this.a = 1
    }
    toJSON () { return {r: this.r, g: this.g, b: this.b, a: this.a} }
    toString () { return "#"
        + Math.floor(this.r).toString(16).padStart(2, "0")
        + Math.floor(this.g).toString(16).padStart(2, "0")
        + Math.floor(this.b).toString(16).padStart(2, "0")
        + (this.A < 255 ? Math.floor(this.A).toString(16).padStart(2, "0") : "");
    }
    toRGBA () { return `rgba(${this.r}, ${this.g}, ${this.b}, ${this.a})` }
    clone () { return new Color(this.r, this.g, this.b, this.a) }

    get isColor () { return true }
    get r () { return this.#r }
    get g () { return this.#g }
    get b () { return this.#b }
    get a () { return this.#a / 255 }
    get A () { return this.#a }
    set r (number) { return (this.#r = Color.#setValue(number)) }
    set g (number) { return (this.#g = Color.#setValue(number)) }
    set b (number) { return (this.#b = Color.#setValue(number)) }
    set a (number) { return (this.#a = Color.#setValue(number * 255)) }
    set A (number) { return (this.#a = Color.#setValue(number)) }

    static #setValue (value) { return clamp(value, 0, 255) }
}
