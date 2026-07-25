import { Path } from "../math/Path.js";
import { Vector } from "../math/Vector.js";
import { equals } from "../math/utils.js";
import { TrackableObject } from "../utils/tracking/TrackableObject.js";

export class PhysicsObject extends TrackableObject {
    #tracer = new Path();
    #time = 0; // in seconds
    #origin = {
        position: new Vector(),
        velocity: new Vector()
    };
    #current = {
        position: new Vector(),
        velocity: new Vector()
    };
    constructor (origin, velocity, acceleration, drag) {
        super();
        this.drag = drag; // coefficient, values >1 will make projectiles move backwards infinitely
        this.acceleration = new Vector(acceleration);

        this.origin.position.apply(origin);
        this.origin.velocity.apply(velocity);
        this.current.position.apply(origin);
        this.current.velocity.apply(velocity);
    }

    updatePosition (seconds) {
        const { position, velocity } = this;
        const acceleration = this.acceleration.clone();
        const v = velocity.mul(-this.drag * Math.sqrt(velocity.pow(2).sum()));
        if (velocity.x < 0)
            acceleration.x *= -1;
        else if (equals(velocity.x, 0)) 
            acceleration.x *= 0;
        position.add(velocity.mul(seconds), true);
        velocity.add(acceleration.add(v).mul(seconds, true), true);
    }
    projectPosition (seconds) {
        const { position, velocity } = this;
        if (this.isStopped) return {
            position: position.clone(),
            velocity: velocity.clone(),
            delta: new Vector()
        };
        const acceleration = this.acceleration.clone();
        const vel = velocity.mul(-this.drag * Math.sqrt(velocity.pow(2).sum()));
        if (velocity.x < 0)
            acceleration.x *= -1;
        else if (equals(velocity.x, 0)) 
            acceleration.x *= 0;
        const p = position.add(velocity.mul(seconds));
        const v = velocity.add(acceleration.add(vel).mul(seconds, true));
        return {
            position: p,
            velocity: v,
            delta: p.sub(position)
        };
    }
    update (seconds = 1) {
        this.tracer.push(this.position.clone());
        if (!this.isStopped) this.updatePosition(seconds);
        this.#time += seconds;
        return this.position;
    }
    // simulate update
    project (seconds = 1) {
        const projection = this.projectPosition(seconds);
        projection.time = this.time + seconds;
        return projection;
    }
    reset () {
        this.current.position.apply(this.origin);
        this.current.velocity.apply(this.velocity);
        this.#time = 0;
    }

    get isPhysicsObject () { return true }
    get speed () { return this.velocity.length }
    get position () { return this.current.position }
    get velocity () { return this.current.velocity }
    get direction () { return this.velocity.normalize() }
    get tracer () { return this.#tracer }
    get time () { return this.#time }
    get origin () { return this.#origin }
    get current () { return this.#current }
    get isStopped () { return equals(this.speed, 0) }
    clone () { return new Projectile(this.origin.position, this.origin.velocity, this.acceleration, this.drag) }
}
