import { Path } from "../math/Path.js";
import { Vector } from "../math/Vector.js";
import { equals } from "../math/utils.js";
import { Identifiable } from "../utils/tracking/Identifiable.js";

export class PhysicsObject extends Identifiable {
    #tracer = new Path();
    #time = 0; // in seconds
    acceleration = new Vector();
    ambient = new Vector(); // applied constantly/unconditionally
    force = new Vector(); // applied, then cleared after every update
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
        this.acceleration.apply(acceleration);

        this.origin.position.apply(origin);
        this.origin.velocity.apply(velocity);
        this.current.position.apply(origin);
        this.current.velocity.apply(velocity);
    }

    // [!] mutating
    #applyForce (position, velocity, seconds) {
        const acceleration = this.acceleration.clone();
        const ambient = this.ambient.clone();
        const speed = velocity.length;
        const vel = this.drag === 0
            ? velocity.clone()
            : velocity.mul(-this.drag * velocity.length);
        if (speed) {
            acceleration.x *= Math.sign(velocity.x);
            acceleration.y *= Math.sign(velocity.y);
        } else {
            acceleration.apply(0, 0);
        }
        const force = ambient.add(acceleration, true).add(this.force, true);
        position.add(velocity.mul(seconds), true);
        velocity.add(force.add(vel, true).mul(seconds, true), true);
    }

    updatePosition (seconds) {
        this.#applyForce(this.position, this.velocity, seconds);
        this.force.apply(0, 0);
    }
    projectPosition (seconds) {
        const position = this.position.clone();
        const velocity = this.velocity.clone();
        const moving = !this.isStopped;
        if (moving) this.#applyForce(position, velocity, seconds);
        return {
            position: position,
            velocity: velocity,
            delta: moving
                ? position.sub(this.position)
                : new Vector()
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
    applyOrigin (position = undefined, velocity = undefined) {
        if (position?.isVector) this.origin.position.apply(position);
        if (velocity?.isVector) this.origin.velocity.apply(velocity);
        if (!this.time) this.reset();
    }
    reset () {
        this.current.position.apply(this.origin.position);
        this.current.velocity.apply(this.origin.velocity);
        this.#time = 0;
    }
    clone () {
        const physObj = new PhysicsObject(this.origin.position, this.origin.velocity, this.acceleration, this.drag);
        physObj.ambient.apply(this.ambient);
        return physObj;
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
}
