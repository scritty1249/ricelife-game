import Default from "./default.js";
import { Vector, Color } from "../../geometry/vector.js";
import { Circle } from "../../geometry/shape.js";
import { Blast } from "../blast.js";
import { Shot } from "../shot.js";
import { Properties, Behavior } from "../collision/collision.js";

export default class Digger extends Default {
    static collisionCallback (point, normal, collisionFlags) {
        const { shot } = this;
        const direction = shot.current.velocity.normalize();
        const doBlast = normal === undefined || normal.y >= 0 // only apply blasts and count bounces if normal is not negative (colliding surface faces up)
            || (collisionFlags & Properties.PLAYER); // or if hitting a player
        if (!(collisionFlags & Properties.STOP) && this.userData.bounces < this.userData.maxBounces) {
            if (doBlast) {
                // update projectile
                const reflection = shot.current.velocity.apply(0,
                        175 * (doBlast ? 1 : -1)
                    ).clone();
                shot.drag = 0.002;
                shot.acceleration.y = -300;
                const displace = normal
                    .mul(Math.max(...shot.shape.getBoundingBox().size) / 2);
                shot.applyPosition(shot.position.add(displace));
                this.userData.bounces++;
            } else {
                const { reflect } = Behavior.computeBounce.call(this, normal);
                shot.current.velocity.apply(reflect.mul(this.userData.ricochetVelocityScaleMultipler, true));
                // if it's already created a blast (bounce was counted), scale velocity mulitplier more
                if (this.userData.bounces) this.userData.ricochetVelocityScaleMultipler *= this.userData.ricochetVelocityScaleMultipler;
                this.userData.ricochetVelocityScaleMultipler *= this.userData.ricochetVelocityScaleMultipler;
            }
            // callback
            this.userData.onBounce();
            this.userData.onBounceCallback?.();
        } else {
            shot.current.velocity.mul(0, true);
        }
        if (doBlast) Behavior.createBlasts.call(this);
    }
    static onBounce () {} // override, don't modify cosmetically
    static onBounceCallback () {} // override, don't play bounce sfx
    static blastRadius = 40;
    static maxBounces = 4;
    static initalSpeed = 500;
    static drag = 0.003;
    static radius = 8;
    static glowColor = new Color(210, 165, 0);
    static mainColor = new Color(200, 90, 0);
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
        const hitbox = [new Blast(new Circle(blastRadius), 0, 20)];
        // generate stages
        const stage = this.newStage().newStage(shot);
        stage.userData = { hitbox,
            bounces: 0,
            maxBounces: this.constructor.maxBounces,
            onBounce: this.constructor.onBounce.bind(stage),
            onBounceCallback: this.constructor.onBounceCallback.bind(stage),
            bounceVelocityMultiplier: this.constructor.bounceVelocityMultiplier,
            bounceGlowReduction: this.constructor.bounceGlowReduction,
            ricochetVelocityScaleMultipler: .5 // slows down the shot if bounced off any surface that isn't the ground (discourage repeatedly banking this shot off of walls)
        };
        stage.collisionCallback = this.constructor.collisionCallback;
    }
}
