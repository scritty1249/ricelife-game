import Bouncer from "./bouncer.js";
import { Vector } from "../core/math/Vector.js";

export default class MegaBouncer extends Bouncer {
    static onBounce () {
        const { projectile } = this;
        const { maxBounces } = this.userData;
        // apply cosmetic updates
        const brighten = this.userData.bounceGlowLimit / maxBounces;
        projectile.glowColor.r += brighten;
        projectile.glowColor.g += brighten;
        projectile.glowColor.b += brighten;
        const grow = this.userData.bounceGlowRadiusLimit / maxBounces;
        projectile.glowRadius += grow;
        projectile.glowColor.a *= this.bounceGlowAlphaMultiplier;
        const tail = this.userData.bounceTailLengthLimit / maxBounces;
        projectile.tailLength += tail;
        // "functional" updates
        if (this.userData.hitbox) {
            const factor = this.userData.bounceBlastScaleFactor;
            this.userData.hitbox.forEach((blast) => {
                const { shape } = blast;
                blast.damage *= this.userData.bounceDamageMultiplier;
                shape.transform.save();
                shape.transform.reset();
                shape.transform.scale.apply(factor);
                shape.applyTransform();
                shape.transform.restore();
            });
        }
        const acceleration = this.userData.bounceAccelerationLimit.div(maxBounces);
        projectile.acceleration.add(acceleration);
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
        const shot = this.stages[0].shots[0];
        // adjust cosmetics
        shot.userData.hitbox.at(0).radius = 30;
        shot.projectile.glowColor.a = .4;
        shot.userData.bounceAccelerationLimit = this.constructor.bounceAccelerationLimit;
        shot.userData.bounceTailLengthLimit = this.constructor.bounceTailLengthLimit;
        shot.userData.bounceGlowLimit = this.constructor.bounceGlowLimit;
        shot.userData.bounceGlowAlphaMultiplier = this.constructor.bounceGlowAlphaMultiplier;
        shot.userData.bounceGlowRadiusLimit = this.constructor.bounceGlowRadiusLimit;
        shot.userData.bounceBlastScaleFactor = this.constructor.bounceBlastScaleFactor;
        shot.userData.bounceDamageMultiplier = this.constructor.bounceDamageMultiplier;
    }
}