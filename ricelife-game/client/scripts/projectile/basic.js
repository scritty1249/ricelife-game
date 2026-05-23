import { Projectile, BasicShot } from "./default.js";
import { TrackingCircle, Circle, Vector, Direction, Color } from "../geometry/geometry.js";
import { deg2rad } from "../utils.js";

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

export class Flower extends BasicShot {
    static config = {
        initalSpeed: 400,
        acceleration: new Vector(20, 200),
        drag: 0.001,
        radius:  7.5,
        blastRadius: 25
    };
    constructor (origin, angle, power = 1, resolution = 1) {
        super(origin, angle, power, resolution);
        this.blast._shapes.splice(0, this.blast._shapes.length);
        this.blast._shapes.push(...Array.from([0, 360/7, 720/7, 1080/7, 1440/7, 1800/7, 2160/7], (angle) => {
            const rad = deg2rad(angle);
            return new TrackingCircle(new Vector(Math.cos(rad), Math.sin(rad)).mul(this.config.radius + (this.config.blastRadius * 1.75)), this.config.blastRadius, this.current)}));
    }
}