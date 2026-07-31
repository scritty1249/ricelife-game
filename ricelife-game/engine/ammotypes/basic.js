import Default from "./Default.js";
import { Vector } from "../core/math/Vector.js";
import { Circle } from "../core/geometry/Circle.js";
import { Blast } from "../core/projectile/Blast.js";
import { Projectile } from "../core/projectile/Projectile.js";

export default class Basic extends Default {
    constructor (origin, angle, power = 1, resolution = 1) {
        super(origin, angle, power, resolution);
        // geometry config
        const { initalSpeed, drag, radius, blastRadius, glowColor, mainColor } = this.constructor;
        const acceleration = this.constructor.acceleration.clone();
        // convert params for Shot(s)
        const velocity = Vector.fromAngle(angle).mul(initalSpeed * power);
        // init geometry
        const shape = new Circle(radius, origin);
        const shot = new Projectile(origin, velocity, acceleration, drag, shape);
        shot.glowColor.apply(glowColor);
        shot.mainColor.apply(mainColor);
        const hitbox = [new Blast(new Circle(blastRadius), 0, 15)];
        // generate stages
        const stage = this.stages[0].newStage(shot);
        stage.userData = { hitbox };
        stage.collisionCallback = this.constructor.collisionCallback;
    }
}
