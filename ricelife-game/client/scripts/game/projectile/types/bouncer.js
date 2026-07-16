import Default from "./default.js";
import { Vector, Color } from "../../geometry/vector.js";
import { Circle } from "../../geometry/shape.js";
import { Blast } from "../blast.js";
import { Shot } from "../shot.js";
import { Properties, Behavior } from "../collision/collision.js";

export default class Bouncer extends Default {
    static collisionCallback (point, normal, collisionFlags) {
        const { shot } = this;
        const { position, velocity } = shot.current;
        if ((!this.userData.stopOnPlayer || !(collisionFlags & Properties.PLAYER)) // blow up instantly if hitting a player
            && !(collisionFlags & Properties.STOP)
            && this.userData.bounces < this.userData.maxBounces
        ) {
            const { reflect } = Behavior.computeBounce.call(this, normal);
            // update projectile
            velocity.apply(reflect.mul(this.userData.bounceVelocityMultiplier));
            this.userData.bounces++;
            // callback
            this.userData.onBounce();
            this.userData.onBounceCallback?.();
        } else {
            Behavior.createBlasts.call(this);
            velocity.mul(0, true);
        }
    }
    static onBounce () {
        const { shot } = this;
        // apply cosmetic updates
        const reduce = this.userData.bounceGlowReduction / this.userData.maxBounces;
        shot.glowColor.r -= reduce;
        shot.glowColor.g -= reduce;
        shot.glowColor.b -= reduce;
        this.playSfx("bounce");
    }
    static onBounceCallback () {} // this does not apply to Projectile tracing performed by web workers. Operations done in this callback should be cosmetic-only: should NOT change projectile movement or hitbox
    static bounceVelocityMultiplier = new Vector(.9, .9);
    static maxBounces = 3;
    static bounceGlowReduction = 50;
    static stopOnPlayer = true;
    static glowColor = new Color(128, 0, 128);
    static mainColor = new Color(255, 240, 255);
    constructor (origin, angle, power = 1, resolution = 1) {
        super(origin, angle, power, resolution);
        // geometry config
        const { initalSpeed, drag, radius, blastRadius, glowColor, mainColor } = this.constructor;
        const acceleration = this.constructor.acceleration.clone();
        // convert params for Shot(s)
        const velocity = Vector.fromAngle(angle).mul(400 * power);
        // init geometry
        const shape = new Circle(radius, origin);
        const shot = new Shot(origin, velocity, acceleration, drag, shape);
        shot.glowColor.apply(glowColor);
        shot.mainColor.apply(mainColor);
        const hitbox = [new Blast(new Circle(blastRadius), 0, 25)];
        // generate stages
        const stage = this.stages[0].newStage(shot);
        stage.userData = { hitbox,
            bounces: 0,
            maxBounces: this.constructor.maxBounces,
            onBounce: this.constructor.onBounce.bind(stage),
            onBounceCallback: this.constructor.onBounceCallback.bind(stage),
            bounceVelocityMultiplier: this.constructor.bounceVelocityMultiplier,
            bounceGlowReduction: this.constructor.bounceGlowReduction,
            stopOnPlayer: this.constructor.stopOnPlayer
        };
        stage.collisionCallback = this.constructor.collisionCallback;
    }
}
