import { Vector } from "../../math/Vector.js";

export class Collision {
    static decode (obj) {
        const [ time, flags, pos, pt, norm, vel, reb ] = obj;
        const position = Vector.fromObject(pos);
        const point = Vector.fromObject(pt);
        const normal = Vector.fromObject(norm);
        const velocity = Vector.fromObject(vel);
        const rebound = Vector.fromObject(reb);
        return new Collision(time, flags, position, point, normal, velocity, rebound);
    }
    static fromObject (obj) {
        const { time, flags, position: pos, point: pt, normal: norm, velocity: vel, rebound: reb } = obj;
        const position = Vector.fromObject(pos);
        const point = Vector.fromObject(pt);
        const normal = Vector.fromObject(norm);
        const velocity = Vector.fromObject(vel);
        const rebound = Vector.fromObject(reb);
        return new Collision(time, flags, position, point, normal, velocity, rebound);
    }
    #position = new Vector();
    #point = new Vector();
    #velocity = new Vector();
    #normal = new Vector();
    #rebound = new Vector();
    #flags;
    #time;
    constructor (time, flags, position, point, normal, velocity, rebound) {
        this.#time = time;
        this.#flags = flags;
        if (position?.isVector) this.position.apply(position);
        if (point?.isVector) this.point.apply(point);
        if (normal?.isVector) this.normal.apply(normal);
        if (velocity?.isVector) this.velocity.apply(velocity);
        if (rebound?.isVector) this.rebound.apply(rebound);
    }

    encode () {
        return [
            this.time,
            this.flags,
            this.position.toJSON(),
            this.point.toJSON(),
            this.normal.toJSON(),
            this.velocity.toJSON(),
            this.rebound.toJSON(),
        ];
    }
    toJSON () {
        return {
            time: this.time,
            flags: this.flags,
            position: this.position.toJSON(),
            point: this.point.toJSON(),
            normal: this.normal.toJSON(),
            velocity: this.velocity.toJSON(),
            rebound: this.rebound.toJSON()
        };
    }
    clone () { return new Collision(this.time, this.flags, this.position, this.point, this.normal, this.velocity, this.rebound) }

    get isCollision () { return true }
    get time () { return this.#time }
    get flags () { return this.#flags }
    get position () { return this.#position }
    get point () { return this.#point }
    get normal () { return this.#normal }
    get velocity () { return this.#velocity }
    get rebound () { return this.#rebound }
}
