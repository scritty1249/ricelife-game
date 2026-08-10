import Default from "./Default.js";
import { Vector } from "../core/math/Vector.js";
import { Color } from "../core/math/Color.js";
import { Circle } from "../core/geometry/Circle.js";
import { Blast } from "../core/projectile/Blast.js";
import { Projectile } from "../core/projectile/Projectile.js";
import { createBlasts } from "../core/projectile/collision/Behaviors.js";

// fires a "stem" that bounces straight up upon collision. After reaching Y height, turns into N "needle" shots that umbrella downwards in an enveloping arc.
export default class Pine extends Default {
    static NAME = "Pine";
    static IMPORT = "Pine";
    static stemTransition () {
        const { projectile } = this;
        if (projectile.current.velocity.y <= this.userData.speedThreshold) {
            this.userData.setupNextStage();
            projectile.current.velocity.mul(0, true);
        }
    }
    static setupNeedleStage (needleStage) {
        const pos = this.projectile.position.clone();
        const time = this.time;
        needleStage.shots.forEach((stage) => {
            const { projectile } = stage;
            projectile.origin.position.apply(pos);
            projectile.applyPosition(pos);
            stage.blastTimeOffset += time;
        });
    }
    static stemCollisionCallback (point, normal, collisionFlags) {
        const { projectile } = this;
        const doBounce = normal.y >= 0; // only bounce if normal is not negative (colliding surface faces up)- otherwise go stage 2 (spawn needles) immedately
        this.updateCallback = this.userData.stageTransition;
        if (doBounce) {
            const point = projectile.position.clone();
            // update projectile
            const reflection = projectile.current.velocity.apply(this.userData.bounceVelocity).clone();
            projectile.drag = this.userData.bounceDrag;
            projectile.acceleration.apply(this.userData.bounceAcceleration);
        } else {
            projectile.current.velocity.apply(0, 0);
        }
    }
    static needleCollisionCallback (point, normal, collisionFlags) {
        this.projectile.current.velocity.apply(0, 0);
        createBlasts.call(this);
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
    static stemGlowColor = new Color(107, 73, 41);
    static stemMainColor = new Color(102, 91, 78);
    static needleGlowColor = new Color(5, 102, 8);
    static needleMainColor = new Color(0, 81, 26);
    static glowColor = Pine.stemGlowColor;
    static mainColor = Pine.stemMainColor;
    constructor (origin, angle, power = 1, resolution = 1) {
        super(origin, angle, power, resolution);
        // geometry config
        const { initalSpeed, drag, radius, blastRadius, stemGlowColor, stemMainColor, needleGlowColor, needleMainColor } = this.constructor;
        const acceleration = this.constructor.acceleration.clone();
        // convert params for Projectile(s)
        const velocity = Vector.fromAngle(angle).mul(400 * power);
        // init stem geometry
        const stemShape = new Circle(radius, origin);
        const stemShot = new Projectile(origin, velocity, acceleration, drag, stemShape);
        stemShot.glowColor.apply(stemGlowColor);
        stemShot.mainColor.apply(stemMainColor);
        stemShot.tailColor.apply(104.5, 82, 59.5); 
        // init needle geometry
        const _zeroVec = new Vector(); // [!] throwaway, will be overwritten
        const needleAcceleration = this.constructor.needleAcceleration.clone();
        const needleDrag = this.constructor.needleDrag;
        const needleShape = new Circle(radius * (2/3));
        const needleShot = new Projectile(_zeroVec, _zeroVec, needleAcceleration, needleDrag, needleShape);
        needleShot.glowColor.apply(needleGlowColor);
        needleShot.mainColor.apply(needleMainColor);
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
            newNeedleShot.origin.velocity.apply(vel);
            newNeedleShot.current.velocity.apply(vel);
            const needleShotStage = needleStage.newStage(newNeedleShot);
            needleShotStage.userData = { hitbox };
            needleShotStage.collisionCallback = needleCollisionCallback;
            needleShotStage.playLaunchCallback = false;
            needleShots.push(newNeedleShot);
        }
    }
}
