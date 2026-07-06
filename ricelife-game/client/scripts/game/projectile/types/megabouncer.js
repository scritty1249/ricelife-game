import Bouncer from "./bouncer.js";
import { Vector } from "../../geometry/vector.js";

export default class MegaBouncer extends Bouncer {
    static onBounce () {
        const { shot } = this;
        const { maxBounces } = this.userData;
        // apply cosmetic updates
        const brighten = this.userData.bounceGlowLimit / maxBounces;
        shot.glowColor.r += brighten;
        shot.glowColor.g += brighten;
        shot.glowColor.b += brighten;
        const grow = this.userData.bounceGlowRadiusLimit / maxBounces;
        shot.glowRadius += grow;
        shot.glowColor.a *= this.bounceGlowAlphaMultiplier;
        const tail = this.userData.bounceTailLengthLimit / maxBounces;
        shot.tailLength += tail;
        // "functional" updates
        if (this.userData.hitbox) {
            const factor = this.userData.bounceBlastScaleFactor;
            this.userData.hitbox.forEach((blast) => {
                const { shape } = blast;
                blast.damage *= this.userData.bounceDamageMultiplier;
                shape.transformation.save();
                shape.transformation.reset();
                shape.transformation.scale.apply(factor);
                shape.applyTransformation();
                shape.transformation.restore();
            });
        }
        const acceleration = this.userData.bounceAccelerationLimit.div(maxBounces);
        shot.acceleration.add(acceleration);
        this.playSfx("bounce");
    }
    static initalSpeed = 500;
    static acceleration = new Vector(30, -200);
    static drag = 0.002;
    static maxBounces = 3;
    static radius = 15;
    static bounceVelocityMultiplier = new Vector(1.1, 1.3);
    // cap growth per bounce for these values
    static bounceAccelerationLimit = new Vector(-10, -75);
    static bounceTailLengthLimit = 15;
    static bounceGlowLimit = 40;
    static bounceGlowAlphaMultiplier = .7;
    static bounceGlowRadiusLimit = 5;
    static bounceBlastScaleFactor = 1.2;
    static bounceDamageMultiplier = 1.34;
    constructor (origin, angle, power = 1, resolution = 1) {
        super(origin, angle, power, resolution);
        const stage = this.stages[0].stages[0];
        // adjust cosmetics
        stage.userData.hitbox.at(0).radius = 30;
        stage.shot.glowColor.a = .4;
        stage.userData.bounceAccelerationLimit = this.constructor.bounceAccelerationLimit;
        stage.userData.bounceTailLengthLimit = this.constructor.bounceTailLengthLimit;
        stage.userData.bounceGlowLimit = this.constructor.bounceGlowLimit;
        stage.userData.bounceGlowAlphaMultiplier = this.constructor.bounceGlowAlphaMultiplier;
        stage.userData.bounceGlowRadiusLimit = this.constructor.bounceGlowRadiusLimit;
        stage.userData.bounceBlastScaleFactor = this.constructor.bounceBlastScaleFactor;
        stage.userData.bounceDamageMultiplier = this.constructor.bounceDamageMultiplier;
    }
}