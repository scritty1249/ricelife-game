import Basic from "./basic.js";

export default class Sniper extends Basic {
    constructor (origin, angle, power = 1, resolution = 1) {
        super(origin, angle, power, resolution);
        const stage = this.stages[0].stages[0];
        const blast = stage.userData.hitbox[0];
        const shot = stage.shot;
        // adjust sizing
        blast.damage = 60;
        blast.shape.radius = 15;
        shot.velocity.mul(5, true);
        shot.current.velocity.mul(5, true);
        shot.shape.radius = 3;
        // adjust cosmetics
        shot.glowRadius = 3;
        shot.tailLength = 70;
    }
}
