import { Vector } from "../math/Vector.js";
import { typeString } from "../utils/logging.js";

export class Transform {
    static #DEFAULT = { // [!] never modify
        scl: new Vector(1, 1),
        off: new Vector(0, 0), // at origin
        rot: Vector.fromAngle(0) // point up
    };
    static fromObject (obj) {
        const scale = Vector.fromObject(obj.scale);
        const offset = Vector.fromObject(obj.offset);
        const rotation = Vector.fromAngle(obj.angle);
        return new Transform(scale, offset, rotation);
    }
    #scale = Transform.#DEFAULT.scl.clone();
    #offset = Transform.#DEFAULT.off.clone();
    #rotation = Transform.#DEFAULT.rot.clone();
    #stack = new Array(); // save states, allow for save() and restore() calls
    constructor (scale = undefined, offset = undefined, rotation = undefined) {
        if (scale?.isVector) this.scale = scale;
        if (offset?.isVector) this.offset = offset;
        if (rotation?.isVector) this.rotation = rotation;
        else if (Number.isFinite(rotation)) this.angle = rotation;
    }

    // applies Transform to a Vertex
    set (point, mutate = false) {
        if (!point?.isVector) throw new Error(`[${typeString(this)}]: Cannot set transform on non-Vector type ${typeString(point)}`);
        return point
            .mul(this.scale, mutate)
            .rotate(this.rotation, true)
            .add(this.offset, true);
    }
    // applies / copies another Transform to this Transform
    apply (transform) {
        if (!transform?.isTransform) throw new Error(`[${typeString(this)}]: Cannot apply from non-Transform type ${typeString(transform)}`);
        this.offset.apply(transform.offset);
        this.rotation.apply(transform.rotation);
        this.scale.apply(transform.scale);
        return this; // for chaining
    }
    eq (transform) {
        return transform?.isTransform
            && this.offset.eq(transform.offset)
            && this.rotation.eq(transform.rotation)
            && this.scale.eq(transform.scale);
    }
    // compound transforms
    add (transform, mutate = false) {
        if (!transform?.isTransform) throw new Error(`[${typeString(this)}]: Cannot add non-Transform type ${typeString(transform)}`);
        const trans = mutate ? this : this.clone();
        trans.scale.mul(transform.scale, true);
        trans.angle = trans.angle + transform.angle;
        trans.offset.add(transform.offset, true);
        return trans; // for chaining
    }
    reset () {
        this.scale.apply(Transform.#DEFAULT.scl);
        this.offset.apply(Transform.#DEFAULT.off);
        this.rotation.apply(Transform.#DEFAULT.rot);
        return this; // for chaining
    }
    save () { this.#stack.push(this.clone()) }
    restore () { this.apply(this.#stack.pop()) }
    clone () { return new this.constructor(this.scale, this.offset, this.rotation) }
    toString() { return `[${typeString(this)}] < Scale ${this.scale.toString()}, Offset ${this.offset.toString()}, Angle ${this.angle} >` }
    toJSON () { return {scale: this.scale.toJSON(), offset: this.offset.toJSON(), rotation: this.angle } } // pass rotation as radians (Number) to save memory

    get isTransform () { return true }
    get hasUpdate () { return this.scale.eq(Transform.#DEFAULT.scl) || this.offset.eq(Transform.#DEFAULT.off) || this.rotation.eq(Transform.#DEFAULT.rot) }
    get scale () { return this.#scale }
    set scale (value) { return this.#scale.apply(value) }
    get offset () { return this.#offset }
    set offset (value) { return this.#offset.apply(value) }
    get rotation () { return this.#rotation }
    set rotation (value) { return this.#rotation.apply(value) }
    // conversions to and from radians
    get angle () { return this.rotation.angle() }
    set angle (radians) {
        this.rotation = Vector.fromAngle(radians);
        return radians; // for chaining
    }
}
