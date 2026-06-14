import { Projectile, BasicShot } from "./default.js";
import { Circle, Vector, Direction, Color } from "../geometry/geometry.js";
import { deg2rad } from "../utils/utils.js";

export { BasicShot } from "./default.js";

export class Spreader extends BasicShot {
    static initalSpeed = 400;
    static acceleration = new Vector(20, -200);
    static drag = 0.001;
    static radius =  7.5;
    static blastRadius = 25;
    static glowColor = new Color(0, 212, 255);
    constructor (origin, angle, power = 1, resolution = 1) {
        super(origin, angle, power, resolution);

        this.blast.blasts.splice(0, this.blast.blasts.length);
        this.blast.push(new Circle(new Vector(), this.blastRadius, this.resolution), 0);
        this.blast.push(new Circle(new Vector(-this.blastRadius * 1.75, 0), this.blastRadius, this.resolution), 250);
        this.blast.push(new Circle(new Vector(this.blastRadius * 1.75, 0), this.blastRadius, this.resolution), 500);
    }
}

export class Flower extends BasicShot {
    static initalSpeed = 400;
    static acceleration = new Vector(20, -200);
    static drag = 0.001;
    static radius =  7.5;
    static blastRadius = 35;
    static glowColor = new Color(255, 215, 0);
    static glowRadius = 20;
    static glowResolution = 3;
    constructor (origin, angle, power = 1, resolution = 1) {
        super(origin, angle, power, resolution);

        this.blast.blasts.splice(0, this.blast.blasts.length);
        Array.from([0, 360/7, 720/7, 1080/7, 1440/7, 1800/7, 2160/7], (angle, i) => {
            const rad = deg2rad(angle);
            return new Circle(new Vector(Math.cos(rad), Math.sin(rad)).mul(this.config.radius + (this.blastRadius * 1.75)), this.blastRadius, this.resolution)})
            .forEach((shape, i) => this.blast.push(shape, i * 100));
    }
}

export class Digger extends BasicShot {
    static initalSpeed = 500;
    static acceleration = new Vector(10, -300);
    static drag = 0.003;
    static radius =  8;
    static blastRadius = 30;
    static glowColor = new Color(210, 165, 0);
    static mainColor = new Color(200, 90, 0);
    constructor (origin, angle, power = 1, resolution = 1) {
        super(origin, angle, power, resolution);

        this.blast.blasts.splice(0, this.blast.blasts.length);
        this.blast.push(new Circle(new Vector(), this.blastRadius, this.resolution), 0);
        this.blast.push(new Circle(new Vector(0, -this.blastRadius * 1.75), this.blastRadius, this.resolution), 400);
        this.blast.push(new Circle(new Vector(0, -this.blastRadius * 1.75 * 2), this.blastRadius, this.resolution), 800);
        this.blast.push(new Circle(new Vector(0, -this.blastRadius * 1.75 * 3), this.blastRadius, this.resolution), 1200);
    }
}
