import { Ammo, Shot } from "../default.js";
import { Blast } from "../blast.js";
import { Circle, Vector, Color } from "../../geometry/geometry.js";
import { deg2rad, rad2deg } from "../../utils/utils.js";
import * as Properties from "../properties.js";
import * as Behaviors from "../behaviors.js";

// just for easy Ammo type construction
class DefaultAmmo extends Ammo {
    // <this> context will be rebound to ShotStage
    static collisionCallback (point, normal, collisionFlags) { // default
        this.shot.current.velocity.mul(0, true);
        Behaviors.createBlasts.call(this);
    }
    static stageCount = 1;
    static initalSpeed = 400;
    static drag = 0.001;
    static radius = 7;
    static blastRadius = 30;
    static acceleration = new Vector(20, -200);
    constructor (origin, angle, power = 1, resolution = 1) {
        super();
        // store params for cloning
        this.origin = origin.clone();
        this.angle = angle;
        this.power = power;
        this.resolution = resolution;
        // convert params for Shot(s)
        this.initalVelocity = Vector.fromAngle(angle).mul(400 * power);
        // setup stages
        for (let i = 0; i < this.constructor.stageCount; i++) this.newStage();
    }

    clone (deep = false) {
        const other = new this.constructor(this.origin.clone(), this.angle, this.power, this.resolution);
        for (const poly of this.colliders) other.colliders.push(poly); // pass collision references
        return other;
    }
}

export class BasicShot extends DefaultAmmo {
    constructor (origin, angle, power = 1, resolution = 1) {
        super(origin, angle, power, resolution);
        // geometry config
        const { initalSpeed, drag, radius, blastRadius } = this.constructor;
        const acceleration = this.constructor.acceleration.clone();
        // convert params for Shot(s)
        const velocity = Vector.fromAngle(angle).mul(400 * power);
        // init geometry
        const shape = new Circle(radius, origin);
        const shot = new Shot(origin, velocity, acceleration, drag, shape);
        const hitbox = [new Blast(new Circle(blastRadius), 0, 15)];
        // generate stages
        const stage = this.stages[0].newStage(shot);
        stage.userData = { hitbox };
        stage.collisionCallback = this.constructor.collisionCallback;
    }
}

export class Flower extends DefaultAmmo {
    static radius = 7.5;
    static blastRadius = 35;
    constructor (origin, angle, power = 1, resolution = 1) {
        super(origin, angle, power, resolution);
        // geometry config        
        const { initalSpeed, drag, radius, blastRadius } = this.constructor;
        const acceleration = this.constructor.acceleration.clone();
        // convert params for Shot(s)
        const velocity = Vector.fromAngle(angle).mul(400 * power);
        // init geometry
        const shape = new Circle(radius, origin);
        const shot = new Shot(origin, velocity, acceleration, drag, shape);
        shot.glowColor = new Color(255, 215, 0);
        shot.glowRadius = 20;
        shot.glowResolution = 3;
        const hitbox = [];
        Array.from([0, 360/7, 720/7, 1080/7, 1440/7, 1800/7, 2160/7], (angle, i) => {
                const rad = deg2rad(angle);
                return new Circle(blastRadius, Vector.fromAngle(rad).mul(radius + (blastRadius * 1.75)))})
            .forEach((shape, i) => hitbox.push(new Blast(shape, (i * 100) / 1000, 10)));
        // generate stages
        const stage = this.stages[0].newStage(shot);
        stage.userData = { hitbox };
        stage.collisionCallback = this.constructor.collisionCallback;
    }
}

export class Bouncer extends DefaultAmmo {
    static collisionCallback (point, normal, collisionFlags) {
        const { shot } = this;
        const { position, velocity } = shot.current;
        if ((!this.userData.stopOnPlayer || !(collisionFlags & Properties.Collision.PLAYER)) // blow up instantly if hitting a player
            && !(collisionFlags & Properties.Collision.STOP)
            && this.userData.bounces < this.userData.maxBounces
        ) {
            const { reflect, displace } = Behaviors.computeBounce.call(this, normal);
            // update projectile
            shot.applyPosition(position.add(displace));
            velocity.apply(reflect.mul(this.userData.bounceVelocityMultiplier));
            this.userData.bounces++;
            // callback
            this.userData.onBounce();
            this.userData.onBounceCallback?.();
        } else {
            Behaviors.createBlasts.call(this);
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
    constructor (origin, angle, power = 1, resolution = 1) {
        super(origin, angle, power, resolution);
        // geometry config
        const { initalSpeed, drag, radius, blastRadius } = this.constructor;
        const acceleration = this.constructor.acceleration.clone();
        // convert params for Shot(s)
        const velocity = Vector.fromAngle(angle).mul(400 * power);
        // init geometry
        const shape = new Circle(radius, origin);
        const shot = new Shot(origin, velocity, acceleration, drag, shape);
        shot.glowColor = new Color(128, 0, 128);
        shot.mainColor = new Color(255, 240, 255);
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

export class Digger extends DefaultAmmo {
    static collisionCallback (point, normal, collisionFlags) {
        const { shot } = this;
        const direction = shot.current.velocity.normalize();
        const doBlast = normal === undefined || normal.y >= 0 // only apply blasts and count bounces if normal is not negative (colliding surface faces up)
            || (collisionFlags & Properties.Collision.PLAYER); // or if hitting a player
        if (!(collisionFlags & Properties.Collision.STOP) && this.userData.bounces < this.userData.maxBounces) {
            if (doBlast) {
                // update projectile
                const reflection = shot.current.velocity.apply(0,
                        175 * (doBlast ? 1 : -1)
                    ).clone();
                shot.drag = 0.002;
                shot.acceleration.y = -300;
                this.userData.bounces++;
            } else {
                const { reflect, displace } = Behaviors.computeBounce.call(this, normal);
                shot.applyPosition(shot.position.add(displace));
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
        if (doBlast) Behaviors.createBlasts.call(this);
    }
    static onBounce () {} // override, don't modify cosmetically
    static onBounceCallback () {} // override, don't play bounce sfx
    static maxBounces = 4;
    static initalSpeed = 500;
    static drag = 0.003;
    static radius = 8;
    constructor (origin, angle, power = 1, resolution = 1) {
        super(origin, angle, power, resolution);
        // geometry config
        const { initalSpeed, drag, radius, blastRadius } = this.constructor;
        const acceleration = this.constructor.acceleration.clone();
        // convert params for Shot(s)
        const velocity = Vector.fromAngle(angle).mul(400 * power);
        // init geometry
        const shape = new Circle(radius, origin);
        const shot = new Shot(origin, velocity, acceleration, drag, shape);
        shot.glowColor = new Color(210, 165, 0);
        shot.mainColor = new Color(200, 90, 0);
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

// fires a "stem" that bounces straight up upon collision. After reaching Y height, turns into N "needle" shots that umbrella downwards in an enveloping arc.
export class PineShot extends DefaultAmmo {
    static stemTransition () {
        const { shot } = this;
        if (shot.current.velocity.y <= this.userData.speedThreshold) {
            this.userData.setupNextStage();
            shot.current.velocity.mul(0, true);
        }
    }
    static setupNeedleStage (needleStage) {
        const pos = this.shot.position.clone();
        const time = this.time;
        needleStage.stages.forEach((stage) => {
            const { shot } = stage;
            shot.origin.apply(pos);
            shot.applyPosition(pos);
            stage.blastTimeOffset += time;
        });
    }
    static stemCollisionCallback (point, normal, collisionFlags) {
        const { shot } = this;
        const doBounce = normal.y >= 0; // only bounce if normal is not negative (colliding surface faces up)- otherwise go stage 2 (spawn needles) immedately
        this.updateCallback = this.userData.stageTransition;
        if (doBounce) {
            const point = shot.position.clone();
            // update projectile
            const reflection = shot.current.velocity.apply(this.userData.bounceVelocity).clone();
            shot.drag = this.userData.bounceDrag;
            shot.acceleration.apply(this.userData.bounceAcceleration);
            const offset = shot.shape.getBoundingBox().size.length / 4; // if too small, projectile will collide with same surface on exiting side instantly. if too large, projectile will go flying for no reason
            shot.applyPosition(shot.position.add(reflection.normalize().mul(offset, true)));
        } else {
            shot.current.velocity.apply(0, 0);
        }
    }
    static needleCollisionCallback (point, normal, collisionFlags) {
        this.shot.current.velocity.apply(0, 0);
        Behaviors.createBlasts.call(this);
    }
    static stageCount = 2;
    static needleCount = 7; // should be an odd number
    static needleAcceleration = new Vector(0, -250);
    static needleDrag = 0// 0.001;
    static needleLaunchVelocity = new Vector(120, 45);
    static stemTransitionSpeedThreshold = 40; // [!] poorly named, also should be a fraction of stemBounceVelocity
    static stemBounceVelocity = new Vector(0, 200);
    static stemBounceDrag = 0.0015;
    static stemBounceAcceleration = new Vector(0, -100);
    constructor (origin, angle, power = 1, resolution = 1) {
        super(origin, angle, power, resolution);
        // geometry config
        const { initalSpeed, drag, radius, blastRadius } = this.constructor;
        const acceleration = this.constructor.acceleration.clone();
        // convert params for Shot(s)
        const velocity = Vector.fromAngle(angle).mul(400 * power);
        // init stem geometry
        const stemShape = new Circle(radius, origin);
        const stemShot = new Shot(origin, velocity, acceleration, drag, stemShape);
        stemShot.glowColor.apply(107, 73, 41);
        stemShot.mainColor.apply(102, 91, 78);
        stemShot.tailColor.apply(104.5, 82, 59.5); 
        // init needle geometry
        const _zeroVec = new Vector(); // [!] throwaway, will be overwritten
        const needleAcceleration = this.constructor.needleAcceleration.clone();
        const needleDrag = this.constructor.needleDrag;
        const needleShape = new Circle(radius * (2/3));
        const needleShot = new Shot(_zeroVec, _zeroVec, needleAcceleration, needleDrag, needleShape);
        needleShot.glowColor.apply(5, 102, 8);
        needleShot.mainColor.apply(0, 81, 26);
        needleShot.tailColor.apply(2.5, 91.5, 16.5); 
        const hitbox = [new Blast(new Circle(blastRadius), 0, 15)];
        // generate stages
        const stemStage = this.stages[0];
        const needleStage = this.stages[1];
        // first stage "stem"
        const stemShotStage = stemStage.newStage(stemShot);
        stemShotStage.userData = {
            bounceDrag: this.constructor.stemBounceDrag,
            bounceAcceleration: this.constructor.stemBounceAcceleration.clone(),
            bounceVelocity: this.constructor.stemBounceVelocity.clone(),
            speedThreshold: this.constructor.stemTransitionSpeedThreshold,
            previousBounces: this.previousBounces,
            stageTransition: this.constructor.stemTransition,
            setupNextStage: this.constructor.setupNeedleStage.bind(stemShotStage, needleStage)
        };
        stemShotStage.collisionCallback = this.constructor.stemCollisionCallback;
        // second stage "needles"
        const needleCount = this.constructor.needleCount;
        const halfCount = Math.floor(needleCount / 2);
        const needleCollisionCallback = this.constructor.needleCollisionCallback;
        const needleLaunchSpeed = this.constructor.needleLaunchVelocity.clone();
        const needleShots = [];
        for (let i = 0; i < needleCount; i++) {
            const relativeIdx = -(halfCount - i);
            const vel = needleLaunchSpeed.mul({x: (relativeIdx / halfCount), y: 0.25});
            const newNeedleShot = needleShot.clone(true);
            newNeedleShot.velocity.apply(vel);
            newNeedleShot.current.velocity.apply(vel);
            const needleShotStage = needleStage.newStage(newNeedleShot);
            needleShotStage.userData = { hitbox };
            needleShotStage.collisionCallback = needleCollisionCallback;
            needleShots.push(newNeedleShot);
        }
    }
}
