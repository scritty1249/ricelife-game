import Basic from "./basic.js";

export default class Spreader extends Basic {
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
        ogBlast.damage = 10;
        const leftBlast = ogBlast.clone(true);
        leftBlast.shape.moveTo(-blastRadius * 1.75);
        leftBlast.delay = 0.25;
        const rightBlast = leftBlast.clone(true);
        rightBlast.shape.moveTo(-rightBlast.shape.origin.x);
        rightBlast.delay = 0.5;
        stage.userData.hitbox.push(leftBlast, rightBlast);
    }
}
