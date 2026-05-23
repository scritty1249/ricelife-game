import { Projectile, BasicShot } from "./default.js";
import { TrackingCircle, Circle, Vector, Direction, Color } from "../geometry/geometry.js";

export { BasicShot } from "./default.js";

export class Spreader extends BasicShot {
    static config = {
        initalSpeed: 400,
        acceleration: new Vector(20, 200),
        drag: 0.001,
        radius:  7.5,
        blastRadius: 25
    };
    constructor (origin, angle, power = 1, resolution = 1) {
        super(origin, angle, power, resolution);

        this.blast._shapes.push(new TrackingCircle(new Vector(-this.config.blastRadius * 1.75, 0), this.config.blastRadius, this.blast._shapes[0]))
        this.blast._shapes.push(new TrackingCircle(new Vector(this.config.blastRadius * 1.75, 0), this.config.blastRadius, this.blast._shapes[0]))
    }
}