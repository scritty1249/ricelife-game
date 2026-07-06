import Default from "./default.js";
import { Vector } from "../../geometry/vector.js";
import { Circle } from "../../geometry/shape.js";
import { Blast } from "../blast.js";
import { Shot } from "../shot.js";

export default class Rapid extends Default {
    static burstCount = 12;
    static burstDelay = .2; // seconds
    static radius = 5;
    static blastRadius = 6;
    constructor (origin, angle, power = 1, resolution = 1) {
        super(origin, angle, power, resolution);
        // geometry config
        const { initalSpeed, drag, radius, blastRadius, burstCount, burstDelay, collisionCallback } = this.constructor;
        const acceleration = this.constructor.acceleration.clone();
        // init geometry
        const shape = new Circle(radius, origin);
        const hitbox = [new Blast(new Circle(blastRadius), 0, 15)];
        // generate stages
        const multi = this.stages[0];
        for (let i = 0; i < burstCount; i++) {
            const ang = angle + (
                ((-1)**(i % 2))
                * (Math.PI / 12)
                * (i % 2 === 0
                    ? i / burstCount
                    : (burstCount - i) / burstCount
                )
            );
            const velocity = Vector.fromAngle(ang).mul(initalSpeed * power);
            const shot = new Shot(origin, velocity, acceleration, drag, shape);
            const stage = multi.newStage(shot.clone(true), i * burstDelay);
            stage.userData = { hitbox };
            stage.collisionCallback = collisionCallback;
        }
    }
}