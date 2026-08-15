import { Vector } from "../math/Vector.js";
import { Color } from "../math/Color.js";
import { Ammo } from "./Ammo.js";
import { createBlasts } from "./collision/Behaviors.js";

// easy Ammo type construction
export class AmmoType extends Ammo {
    static encode (...params) {
        const [o, angle, power, resolution, _ = undefined] = params;
        const origin = Vector.fromObject(o);
        return new this(origin, angle, power, resolution);
    }
    // <this> context will be rebound to Shot
    static collisionCallback (point, normal, collisionFlags) { // default
        this.projectile.current.velocity.mul(0, true);
        createBlasts.call(this);
    }
    static stageCount = 1;
    static initalSpeed = 400;
    static drag = 0.001;
    static radius = 7;
    static blastRadius = 30;
    static acceleration = new Vector(0, 0);
    static ambient = new Vector(0, -200);
    static glowColor = new Color(255, 0, 0);
    static mainColor = new Color(255, 255, 255);
    constructor (origin, angle, power = 1, resolution = 1) {
        super();
        // store params for cloning
        this.origin = origin.clone();
        this.angle = angle;
        this.power = power;
        this.resolution = resolution;
        // store params for decoding
        this.decodeParams.splice(
            0, this.decodeParams.length,
            origin.toJSON(),
            angle,
            power,
            resolution
        );
        // convert params for Shot(s)
        this.initalVelocity = Vector.fromAngle(angle).mul(this.constructor.initalSpeed * power);
        // setup stages
        for (let i = 0; i < this.constructor.stageCount; i++) this.newStage();
    }

    clone (deep = false) {
        const other = new this.constructor(this.origin.clone(), this.angle, this.power, this.resolution);
        for (const poly of this.colliders) other.colliders.push(poly); // pass collision references
        return other;
    }

    get isAmmoType () { return true }
}
