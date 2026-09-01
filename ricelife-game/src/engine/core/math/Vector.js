// [!] 2D is implied here

import { round, equals } from "./utils.js";
import { FNV1a, Hashable } from "./Hash.js";
import { typeString } from "../utils/logging.js";

export class Vector extends Hashable {
    static *tween (start, stop, step) {
        const diff = stop.sub(start),
            dist = Math.hypot(...diff);
        if (dist === 0) return; 
        const incr = diff.div(dist);
        for (let i = step; i < dist; i += step) {
            yield start.add(incr.mul(i));
        }
    }
    static fromObject (object) {
        return Array.isArray(object)
            ? new Vector(...object)
            : new Vector(object?.x, object?.y);
    }
    static fromAngle (radians) { return new Vector(Math.cos(radians), Math.sin(radians)) }
    static average (vectors = []) {
        if (!vectors.every((vec) => vec.isVector)) throw new Error(`[${typeString(this)}]: Cannot find Vector average with non-Vector type(s)`);
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
        return (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1)
            ? start1.add(end1.sub(start1).mul(ua, true)) // [!] wasteful - KT
            : null;
    }
    static isBetween (target, start, end) {
        return start.cross(target) >= 0
            && target.cross(end) >= 0;
    }

    constructor(x = 0, y = null) {
        super();
        this.apply(x, y)
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
    normal (targetVector, clockwise = true) { // finds normalized point perpendicular to the line 
        if (!targetVector.isVector) throw new Error(`[${typeString(this)}] Error: Cannot calculate normal from Vector to non-Vector type ${typeString(targetVector)}`);
        const diff = targetVector.sub(this);
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
        vec.x = round(vec.x, precision);
        vec.y = round(vec.y, precision);
        return vec;
    }
    floor (mutate = false) {
        const vec = mutate ? this : this.clone();
        vec.x = Math.floor(vec.x);
        vec.y = Math.floor(vec.y);
        return vec;
    }
    ceil (mutate = false) {
        const vec = mutate ? this : this.clone();
        vec.x = Math.ceil(vec.x);
        vec.y = Math.ceil(vec.y);
        return vec;
    }
    precision (precision, mutate = false) {
        const vec = mutate ? this : this.clone();
        const power = 10**precision;
        return vec.mul(power, true).floor(true).div(power, true);
    }
    lerp (vector, factor, mutate = false) { // (Linear Interpolation) returns the point between this vector and given vector. distance from this vector determined by factor given
        if (!vector?.isVector) throw new Error(`[${typeString(this)}] Error: Cannot linearly interpolate between Vector and non-Vector type ${typeString(vector)}`);
        return this.add(vector.sub(this).mul(factor, true), mutate);
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
        if (equals(angle.x, 0) && equals(angle.y, 0)) return vec; // no rotation
        const x = vec.mul(angle).diff();
        const y = vec.mul(angle.transpose()).sum();
        return vec.apply(x, y);
    }
    pivot (radians, origin, mutate = false) {
        const vec = mutate ? this : this.clone();
        return vec.sub(origin, true).rotate(radians, true).add(origin, true);
    }
    distance (vector) {
        if (!vector?.isVector) throw new Error(`[${typeString(this)}] Error: Cannot calculate distance between Vector and non-Vector type ${typeString(vector)}`);
        return Math.hypot(vector.x - this.x, vector.y - this.y);
    }
    reflect (origin, mutate = false) {
        if (!origin?.isVector) throw new Error(`[${typeString(this)}] Error: Cannot reflect across non-Vector type ${typeString(origin)}`);
        const vec = origin.add(origin.sub(this));
        return mutate ? this.apply(vec) : vec;
    }
    dot (vector = null) { // dot product
        if (vector !== null && !vector?.isVector) throw new Error(`[${typeString(this)}] Error: Cannot calculate dot product of Vector and non-Vector type ${typeString(vector)}`);
        return this.mul(vector || this).sum();
    }
    cross (vector) { // cross product
        if (!vector?.isVector) throw new Error(`[${typeString(this)}] Error: Cannot calculate cross product of Vector and non-Vector type ${typeString(vector)}`);
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
                if (!vector?.isVector) throw new Error(`[${typeString(this)}] Error: Cannot calculate angle from non-Vector type ${typeString(vector)}`);
                const diff = vector.sub(this);
                const angle = Math.atan2(diff.y, diff.x);
                sumCos += Math.cos(angle);
                sumSin += Math.sin(angle);
            }
            return Math.atan2(sumSin, sumCos);
        }
    }
    eq (vector) { // shorthand equals. stricter comparison (vectors only)
        return vector?.isVector && equals(this.x, vector.x) && equals(this.y, vector.y);
    }
    equals (x, y = null) {
        return (y === null && equals(this.x, x) && equals(this.y, x)) || (equals(this.x, x) && equals(this.y, y));
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
    *[Symbol.iterator] () {
        yield this.x;
        yield this.y;
    }
    clone () { return new Vector(this.x, this.y) }
    toString () { return `(${this.x.toFixed(3)}, ${this.y.toFixed(3)})` }
    toJSON () { return [this.x, this.y] }

    get isVector () { return true }
    get isNormalized () { return equals(this.length, 1) }
    get length () { return Math.sqrt(this.lengthSquared) }
    get lengthSquared () { return this.pow(2).sum() }
    get isFinite () { return Number.isFinite(this.x) && Number.isFinite(this.y) }
    get rawHash () { return FNV1a.Extend32Bit(FNV1a.Base32Bit(this.x), this.y) }
}