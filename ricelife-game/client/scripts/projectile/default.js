import { TrackableObject } from "../utils.js";
import { Vector } from "../geometry/geometry.js";

export class Projectile extends TrackableObject {
    constructor (origin, velocity, acceleration, drag) {
        super();
        this.origin = origin; // allow for references to be passed
        this.drag = drag; // coefficient, values >1 will make projectiles move backwards infinitely
        this.acceleration = new Vector(acceleration);
        this.velocity = new Vector(velocity);
        this.current = {
            position: new Vector(origin),
            velocity: this.velocity.clone()
        };
    }

    get speed () {
        return Math.sqrt(this.current.velocity.pow(2).sum());
    }

    get position () {
        return this.current.position;
    }

    update (seconds = 1) {
        const position = this.current.position;
        const velocity = this.current.velocity;
        const acceleration = this.acceleration;

        const v = velocity.mul(-this.drag * Math.sqrt(velocity.pow(2).sum()));
        velocity.add(this.acceleration.add(v).mul(seconds), true);
        position.add(velocity.mul(seconds), true);

        return position;
    }

    reset () {
        this.current.position.apply(this.origin);
        this.current.velocity.apply(this.velocity);
    }

    positionAt (seconds, resolution = 0.01) {
        if (seconds <= 0) return new Vector(this.origin);
        const position = new Vector(this.origin);
        const velocity = this.velocity.clone();
        let t = 0;
        while (t < seconds) {
            const dt = Math.min(resolution, seconds - t);            
            const v = velocity.mul(-this.drag * Math.sqrt(velocity.pow(2).sum()));
            
            velocity.add(this.acceleration.add(v).mul(dt), true);
            position.add(velocity.mul(dt), true);
            t += dt;
        }

        return position;
    }
}
