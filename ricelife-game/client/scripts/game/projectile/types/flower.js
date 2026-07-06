import Default from "./default.js";
import { Vector, Color } from "../../geometry/vector.js";
import { Circle } from "../../geometry/shape.js";
import { Blast } from "../blast.js";
import { Shot } from "../shot.js";

export default class Flower extends Default {
    static radius = 7.5;
    static blastRadius = 35;
    constructor (origin, angle, power = 1, resolution = 1) {
        super(origin, angle, power, resolution);
        // geometry config        
        const { initalSpeed, drag, radius, blastRadius } = this.constructor;
        const acceleration = this.constructor.acceleration.clone();
        // convert params for Shot(s)
        const velocity = Vector.fromAngle(angle).mul(400 * power);
        // init geometry
        const shape = new Circle(radius, origin);
        const shot = new Shot(origin, velocity, acceleration, drag, shape);
        shot.glowColor = new Color(255, 215, 0);
        shot.glowRadius = 20;
        shot.glowResolution = 3;
        const hitbox = [];
        Array.from([0, 360/7, 720/7, 1080/7, 1440/7, 1800/7, 2160/7], (angle, i) => {
                const rad = deg2rad(angle);
                return new Circle(blastRadius, Vector.fromAngle(rad).mul(radius + (blastRadius * 1.75)))})
            .forEach((shape, i) => hitbox.push(new Blast(shape, (i * 100) / 1000, 10)));
        // generate stages
        const stage = this.stages[0].newStage(shot);
        stage.userData = { hitbox };
        stage.collisionCallback = this.constructor.collisionCallback;
    }
}