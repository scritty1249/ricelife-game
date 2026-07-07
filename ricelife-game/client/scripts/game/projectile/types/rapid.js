import Default from "./default.js";
import { Vector } from "../../geometry/vector.js";
import { Circle } from "../../geometry/shape.js";
import { Blast } from "../blast.js";
import { Shot } from "../shot.js";
import { Random } from "../../utils/utils.js";

export default class Rapid extends Default {
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
    static initalSpeed = 550;
    static drag = 0.0005;
    static radius = 5;
    static blastRadius = 7;
    constructor (origin, angle, power = 1, resolution = 1, seed = Random.seed()) {
        super(origin, angle, power, resolution);
        // random seed
        this.decodeParams.push(seed);
        const random = new Random(seed);
        // geometry config
        const { initalSpeed, drag, radius, blastRadius, burstAccuracy, burstSpread, burstTightSpread, burstCount, burstDelay, collisionCallback } = this.constructor;
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
            const shot = new Shot(origin, velocity, acceleration, drag, shape);
            shot.glowRadius = 12;
            shot.glowColor.apply(255, 255, 255, .4);
            const stage = multi.newStage(shot.clone(true), i * burstDelay);
            stage.userData = { hitbox };
            stage.collisionCallback = collisionCallback;
        }
    }
}