import Basic from "./basic.js";
import { Vector, Color } from "../../geometry/vector.js";
import { Circle } from "../../geometry/shape.js";
import { Blast } from "../blast.js";
import { Shot } from "../shot.js";
import { Properties, Behavior } from "../collision/collision.js";

export default class Pickle extends Basic {
    static collisionCallback (point, normal, collisionFlags) { // default
        // modify hitbox
        const originBlast = this.userData.hitbox[0];
        const originCenter = originBlast.shape.center.clone();
        const blasts = this.userData.hitbox.slice(1);
        const angle = this.shot.velocity.angle() - (Math.PI / 2);
        for (const blast of blasts) {
            const offset = blast.shape.center.pivot(angle, originCenter).sub(blast.shape.center, true);
            blast.shape.transformation.save();
            blast.shape.transformation.reset();
            blast.shape.transformation.offset.apply(offset);
            blast.shape.applyTransformation();
            blast.shape.transformation.restore();
        }
        this.shot.current.velocity.mul(0, true);
        Behavior.createBlasts.call(this);
    }
    static mainColor = new Color(255, 255, 255);
    static glowColor = new Color(75, 173, 81);
    static blastRadius = 20;
    static blastCount = 5;
    static blastDelay = .5; // seconds
    constructor (origin, angle, power = 1, resolution = 1) {
        super(origin, angle, power, resolution);
        const stage = this.stages[0].stages[0];
        const { blastRadius, glowColor, mainColor, blastCount, blastDelay } = this.constructor;
        // adjust cosmetics
        stage.shot.glowColor.apply(glowColor);
        stage.shot.mainColor.apply(mainColor);
        stage.shot.tailColor.apply(255, 255, 255, 1);
        // change hitbox
        const ogBlast = stage.userData.hitbox[0];
        ogBlast.damage = 10;
        for (let i = 0; i < blastCount; i++) {
            const blast = ogBlast.clone(true);
            blast.delay = blastDelay * i;
            blast.shape.moveTo(0, blastRadius * i);
            stage.userData.hitbox.push(blast);
        }
    }
}