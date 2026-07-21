import Default from "./default.js";
import { Vector, Color } from "../../geometry/vector.js";
import { Circle } from "../../geometry/shape.js";
import { Blast } from "../blast.js";
import { Shot } from "../shot.js";

export default class Flower extends Default {
    static petalCount = 7;
    static radius = 7.5;
    static blastRadius = 35;
    static glowColor = new Color(255, 215, 0);
    constructor (origin, angle, power = 1, resolution = 1) {
        super(origin, angle, power, resolution);
        // geometry config        
        const { initalSpeed, drag, radius, petalCount, blastRadius, glowColor, mainColor } = this.constructor;
        const acceleration = this.constructor.acceleration.clone();
        // convert params for Shot(s)
        const velocity = Vector.fromAngle(angle).mul(400 * power);
        // init geometry
        const shape = new Circle(radius, origin);
        const shot = new Shot(origin, velocity, acceleration, drag, shape);
        shot.glowColor.apply(glowColor);
        shot.mainColor.apply(mainColor);
        shot.glowRadius = 20;
        shot.glowResolution = 3;
        const hitbox = [];
        const fullCircle = Math.PI * 2;
        for (let i = 0; i < petalCount; i++) {
            const angle = (i / petalCount) * fullCircle;
            const blast = new Blast(
                new Circle(blastRadius, Vector
                    .fromAngle(angle).mul(radius + (blastRadius * 1.75))),
                i / 10,
                10
            );
            hitbox.push(blast);
        }
        // generate stages
        const stage = this.stages[0].newStage(shot);
        stage.userData = { hitbox };
        stage.collisionCallback = this.constructor.collisionCallback;
    }
}