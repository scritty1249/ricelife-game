import { AmmoType } from "../core/projectile/AmmoType.js";
import { Vector } from "../core/math/Vector.js";
import { Color } from "../core/math/Color.js";
import { Circle } from "../core/geometry/Circle.js";
import { Blast } from "../core/projectile/Blast.js";
import { Projectile } from "../core/projectile/Projectile.js";
import { Random } from "../core/math/Random.js";

export default class Rapid extends AmmoType {
    static NAME = "Rapid";
    static IMPORT = "Rapid";
    static encode (...params) {
        const [o, angle, power, resolution, seed, _ = undefined] = params;
        const origin = Vector.fromObject(o);
        return new this(origin, angle, power, resolution, seed);
    }
    static burstSpread = Math.PI / 5;
    static burstTightSpread = Math.PI / 12;
    static burstAccuracy = .4; // percentage chance that the angle will be within tight spread
    static burstCount = 12;
    static burstDelay = .15; // seconds

    static acceleration = new Vector(30, -140);
    static initalSpeed = 550;
    static drag = 0.0005;
    static radius = 3;
    static blastRadius = 7;
    static glowColor = new Color(255, 255, 255, .4);
    constructor (origin, angle, power = 1, resolution = 1, seed = Random.seed()) {
        super(origin, angle, power, resolution);
        // random seed
        this.decodeParams.push(seed);
        const random = new Random(seed);
        // geometry config
        const { initalSpeed, drag, radius, blastRadius, burstAccuracy, burstSpread, burstTightSpread, burstCount, burstDelay, collisionCallback, glowColor } = this.constructor;
        const acceleration = this.constructor.acceleration.clone();
        // init geometry
        const shape = new Circle(radius, origin);
        const hitbox = [new Blast(new Circle(blastRadius), 0, 15)];
        // generate stages
        const multi = this.stages[0];
        for (let i = 0; i < burstCount; i++) {
            const angleOffset = (random.random() - .5) * ((random.random() <= burstAccuracy)
                    ? burstTightSpread
                    : burstSpread);
            const velocity = Vector.fromAngle(angle + angleOffset).mul(initalSpeed * power);
            const projectile = new Projectile(origin, velocity, acceleration, drag, shape);
            projectile.glowRadius = 12;
            projectile.glowColor.apply(glowColor);
            const stage = multi.newStage(projectile.clone(true), i * burstDelay);
            stage.userData = { hitbox };
            stage.collisionCallback = collisionCallback;
        }
    }
}