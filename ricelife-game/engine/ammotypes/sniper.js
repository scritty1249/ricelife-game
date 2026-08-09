import Basic from "./basic.js";

export default class Sniper extends Basic {
    constructor (origin, angle, power = 1, resolution = 1) {
        super(origin, angle, power, resolution);
        const shot = this.stages[0].shots[0];
        const blast = stage.userData.hitbox[0];
        const { projectile } = shot;
        // adjust sizing
        blast.damage = 60;
        blast.shape.radius = 15;
        projectile.velocity.mul(5, true);
        projectile.current.velocity.mul(5, true);
        projectile.shape.radius = 3;
        // adjust cosmetics
        projectile.glowRadius = 3;
        projectile.tailLength = 70;
    }
}
