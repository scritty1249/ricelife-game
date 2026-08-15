import { AmmoType } from "../core/projectile/AmmoType.js";
import { Vector } from "../core/math/Vector.js";
import { Color } from "../core/math/Color.js";
import { Circle } from "../core/geometry/Circle.js";
import { Blast } from "../core/projectile/Blast.js";
import { Projectile } from "../core/projectile/Projectile.js";

export default class Flower extends AmmoType {
    static NAME = "Flower";
    static IMPORT = "Flower";
    static petalCount = 7;
    static radius = 7.5;
    static blastRadius = 35;
    static glowColor = new Color(255, 215, 0);
    constructor (origin, angle, power = 1, resolution = 1) {
        super(origin, angle, power, resolution);
        // geometry config        
        const { initalSpeed, drag, radius, ambient, petalCount, blastRadius, glowColor, mainColor } = this.constructor;
        const acceleration = this.constructor.acceleration.clone();
        // convert params for Projectile(s)
        const velocity = Vector.fromAngle(angle).mul(400 * power);
        // init geometry
        const shape = new Circle(radius, origin);
        const projectile = new Projectile(origin, velocity, acceleration, drag, shape);
        projectile.ambient.apply(ambient);
        projectile.glowColor.apply(glowColor);
        projectile.mainColor.apply(mainColor);
        projectile.glowRadius = 20;
        projectile.glowResolution = 3;
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
        const stage = this.stages[0].newStage(projectile);
        stage.userData = { hitbox };
        stage.collisionCallback = this.constructor.collisionCallback;
    }
}