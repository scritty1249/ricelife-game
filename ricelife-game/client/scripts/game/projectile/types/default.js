import { Vector } from "../../geometry/vector.js";
import { Ammo } from "../ammo.js";
import { Behavior } from "../collision/collision.js";

// just for easy Ammo type construction
export default class Default extends Ammo {
    // <this> context will be rebound to ShotStage
    static collisionCallback (point, normal, collisionFlags) { // default
        this.shot.current.velocity.mul(0, true);
        Behavior.createBlasts.call(this);
    }
    static stageCount = 1;
    static initalSpeed = 400;
    static drag = 0.001;
    static radius = 7;
    static blastRadius = 30;
    static acceleration = new Vector(20, -200);
    constructor (origin, angle, power = 1, resolution = 1) {
        super();
        // store params for cloning
        this.origin = origin.clone();
        this.angle = angle;
        this.power = power;
        this.resolution = resolution;
        // convert params for Shot(s)
        this.initalVelocity = Vector.fromAngle(angle).mul(400 * power);
        // setup stages
        for (let i = 0; i < this.constructor.stageCount; i++) this.newStage();
    }

    clone (deep = false) {
        const other = new this.constructor(this.origin.clone(), this.angle, this.power, this.resolution);
        for (const poly of this.colliders) other.colliders.push(poly); // pass collision references
        return other;
    }
}