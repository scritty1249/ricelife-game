import { Vector, Color } from "../../geometry/geometry.js";
import * as Basic from "./basic.js";
import * as Behaviors from "../behaviors.js";

export class MegaBouncer extends Basic.Bouncer {
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
            this.userData.hitbox.forEach(({shape}) => {
                shape.transformation.save();
                shape.transformation.reset();
                shape.transformation.scale.apply(factor);
                shape.applyTransformation();
                shape.transformation.restore();
            });
        }
        const acceleration = this.userData.bounceAccelerationLimit.div(maxBounces);
        shot.acceleration.add(acceleration);
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
    }
}

export class GigaBouncer extends MegaBouncer {
    static onBounce () {
        Behaviors.createBlasts.call(this);
    }
    static onBounceCallback () {} // override, don't play bounce sfx
    static maxBounces = 2;
}

export class Spreader extends Basic.BasicShot {
    static radius =  7.5;
    static blastRadius = 25;
    constructor (origin, angle, power = 1, resolution = 1) {
        super(origin, angle, power, resolution);
        const stage = this.stages[0].stages[0];
        // adjust cosmetics
        stage.shot.glowColor.apply(0, 212, 255);
        stage.shot.mainColor.apply(255, 105, 180);
        // change hitbox
        const { blastRadius } = this.constructor;
        const ogBlast = stage.userData.hitbox[0];
        const leftBlast = ogBlast.clone(true);
        leftBlast.shape.moveTo(-blastRadius * 1.75);
        leftBlast.delay = 0.25;
        const rightBlast = leftBlast.clone(true);
        rightBlast.shape.moveTo(-rightBlast.shape.origin.x);
        rightBlast.delay = 0.5;
        stage.userData.hitbox.push(leftBlast, rightBlast);
    }
}

export class Sniper extends Basic.BasicShot {
    constructor (origin, angle, power = 1, resolution = 1) {
        super(origin, angle, power, resolution);
        const stage = this.stages[0].stages[0];
        const blast = stage.userData.hitbox[0];
        const shot = stage.shot;
        // adjust sizing
        blast.shape.radius = 15;
        shot.velocity.mul(5, true);
        shot.current.velocity.mul(5, true);
        shot.shape.radius = 3;
        // adjust cosmetics
        shot.glowRadius = 3;
        shot.tailLength = 70;
    }
}
