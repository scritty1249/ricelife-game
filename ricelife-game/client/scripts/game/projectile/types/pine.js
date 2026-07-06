import Default from "./default.js";
import { Vector, Color } from "../../geometry/vector.js";
import { Circle } from "../../geometry/shape.js";
import { Blast } from "../blast.js";
import { Shot } from "../shot.js";
import { Behavior } from "../collision/collision.js";

// fires a "stem" that bounces straight up upon collision. After reaching Y height, turns into N "needle" shots that umbrella downwards in an enveloping arc.
export default class Pine extends Default {
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
            shot.origin.position.apply(pos);
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
        Behavior.createBlasts.call(this);
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
