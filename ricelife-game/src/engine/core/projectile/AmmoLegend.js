import { Vector } from "../math/Vector.js";
import { Collision } from "./collision/Collision.js";

class ShotLegend {
    static decode (obj) {
        const [ duration, collisions, origin ] = obj;
        const other = new ShotLegend();
        other.duration = duration;
        other.setOrigin(Vector.fromObject(origin[0]), Vector.fromObject(origin[1]));
        for (const collision of collisions)
            other.collisions.push(Collision.decode(collision));
        return other;
    }
    static fromObject (obj) {
        const { duration, collisions, origin } = obj;
        const other = new ShotLegend();
        other.duration = duration;
        other.setOrigin(Vector.fromObject(origin.position), Vector.fromObject(origin.velocity));
        for (const collision of collisions)
            other.collisions.push(Collision.fromObject(collision));
        return other;
    }
    #origin = {
        position: new Vector(),
        velocity: new Vector()
    };
    #collisions = new Array();
    duration = 0;
    constructor () {
        Object.freeze(this.#origin);
    }

    setOrigin (position, velocity) {
        this.origin.position.apply(position);
        this.origin.velocity.apply(velocity);
    }
    addCollision (time, flags, position, point, normal, velocity, rebound = undefined) {
        const collision = new Collision(time, flags, position, point, normal, velocity, rebound);
        this.collisions.push(collision);
        return collision;
    }
    encode () {
        return [
            this.duration,
            this.collisions.map((collision) => collision.encode()),
            [
                this.origin.position.toJSON(),
                this.origin.velocity.toJSON()
            ]
        ];
    }
    toJSON () {
        return {
            duration: this.duration,
            collisions: this.collisions.map((collision) => collision.toJSON()),
            origin: {
                position: this.origin.position.toJSON(),
                velocity: this.origin.velocity.toJSON()
            }
        };
    }
    clone () {
        const other = new ShotLegend();
        other.duration = this.duration;
        other.setOrigin(this.origin.position, this.origin.velocity);
        for (const collision of this.collisions)
            other.collisions.push(collision);
        return other;
    }

    get isShotLegend () { return true }
    get collisions () { return this.#collisions }
    get origin () { return this.#origin }
}

class MultishotLegend {
    static decode (obj) {
        const shots = [];
        if (obj?.length)
            for (const shot of obj)
                shots.push(ShotLegend.decode(shot));
        return new MultishotLegend(shots);
    }
    static fromObject (obj) {
        const shots = [];
        if (obj?.length)
            for (const shot of obj)
                shots.push(ShotLegend.fromObject(shot));
        return new MultishotLegend(shots);
    }
    #shots = new Array();
    constructor (shots = []) {
        if (shots?.length)
            for (const shot of shots)
                this.shots.push(shot);
    }

    encode () {
        return this.shots.map((shot) => shot.encode());
    }
    toJSON () {
        return this.shots.map((shot) => shot.toJSON());
    }
    clone () {
        return new MultishotLegend(this.shots);
    }

    get isMultishotLegend () { return true }
    get shots () { return this.#shots }
}

export class AmmoLegend {
    static get Multishot () { return MultishotLegend };
    static get Shot () { return ShotLegend };
    static decode (obj) {
        const [ stages, transfer ] = obj;
        return new AmmoLegend(stages, transfer);
    }
    static fromObject (obj) {
        const { stages, transfer } = obj;
        return new AmmoLegend(stages, transfer);
    }
    static capture (ammo) {
        const stages = ammo.stages.map((stage) => stage.legend);
        const transfer = ammo.encodeTransferData();
        return new AmmoLegend(stages, transfer);
    }
    #ammo;
    #stages;
    #transferData;
    constructor (stages, transferData) {
        this.#stages = Array.isArray(stages) ? stages : [];
        this.#transferData = transferData === Object(transferData) ? transferData : {};
    }

    set (ammo) {
        this.#ammo = ammo;
    }
    encode () {
        return [
            this.stages.map((stage) => stage.encode()),
            this.transfer
        ];
    }
    toJSON () {
        return {
            stages: this.stages.map((stage) => stage.toJSON()),
            transfer: this.transfer
        };
    }
    clone () {
        const params = this.isAmmoSet
            ? [Array.from(this.#stages), structuredClone(this.#transferData)]
            : [];
        const other = new AmmoLegend(...params);
        if (this.isAmmoSet) other.set(this.#ammo);
        return other;
    }

    get isAmmoLegend () { return true }
    get isAmmoSet () { return this.#ammo?.isAmmo }
    get stages () { return this.isAmmoSet ? this.#ammo.stages.map((stage) => stage.legend) : Array.from(this.#stages) }
    get transfer () { return this.isAmmoSet ? this.#ammo.encodeTransferData() : structuredClone(this.#transferData) }
}