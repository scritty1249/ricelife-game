import { Projectile, BasicShot } from "./default.js";
import { Circle, Vector, Direction, Color } from "../geometry/geometry.js";
import { deg2rad } from "../utils/utils.js";

export { BasicShot } from "./default.js";

export class Spreader extends BasicShot {
    static config = {
        initalSpeed: 400,
        acceleration: new Vector(20, -200),
        drag: 0.001,
        radius:  7.5,
        blastRadius: 25
    };
    constructor (origin, angle, power = 1, resolution = 1) {
        super(origin, angle, power, resolution);

        this.config.color.glow.apply(0, 212, 255);

        this.blast.blasts.splice(0, this.blast.blasts.length);
        this.blast.push(new Circle(new Vector(), this.config.blastRadius, this.resolution), 0);
        this.blast.push(new Circle(new Vector(-this.config.blastRadius * 1.75, 0), this.config.blastRadius, this.resolution), 250);
        this.blast.push(new Circle(new Vector(this.config.blastRadius * 1.75, 0), this.config.blastRadius, this.resolution), 500);
    }
}

export class Flower extends BasicShot {
    static config = {
        initalSpeed: 400,
        acceleration: new Vector(20, -200),
        drag: 0.001,
        radius:  7.5,
        blastRadius: 35
    };
    constructor (origin, angle, power = 1, resolution = 1) {
        super(origin, angle, power, resolution);

        this.config.color.glow.apply(255, 215, 0);
        this.config.glow.radius = 20;
        this.config.glow.resolution = 3;

        this.blast.blasts.splice(0, this.blast.blasts.length);
        Array.from([0, 360/7, 720/7, 1080/7, 1440/7, 1800/7, 2160/7], (angle, i) => {
            const rad = deg2rad(angle);
            return new Circle(new Vector(Math.cos(rad), Math.sin(rad)).mul(this.config.radius + (this.config.blastRadius * 1.75)), this.config.blastRadius, this.resolution)})
            .forEach((shape, i) => this.blast.push(shape, i * 100));
    }
}

export class Digger extends BasicShot {
    static config = {
        initalSpeed: 500,
        acceleration: new Vector(10, -300),
        drag: 0.003,
        radius:  8,
        blastRadius: 30
    };
    constructor (origin, angle, power = 1, resolution = 1) {
        super(origin, angle, power, resolution);

        this.config.color.main.apply(200, 90, 0);
        this.config.color.glow.apply(210, 165, 0);

        this.blast.blasts.splice(0, this.blast.blasts.length);
        this.blast.push(new Circle(new Vector(), this.config.blastRadius, this.resolution), 0);
        this.blast.push(new Circle(new Vector(0, -this.config.blastRadius * 1.75), this.config.blastRadius, this.resolution), 400);
        this.blast.push(new Circle(new Vector(0, -this.config.blastRadius * 1.75 * 2), this.config.blastRadius, this.resolution), 800);
        this.blast.push(new Circle(new Vector(0, -this.config.blastRadius * 1.75 * 3), this.config.blastRadius, this.resolution), 1200);
    }
}
