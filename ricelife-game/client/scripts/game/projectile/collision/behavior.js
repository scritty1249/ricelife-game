// reusable collision behaviors

// should be bound to ShotStage
// computes bounce trajectory and return with related math
export function computeBounce (normal) {
    const { position, velocity } = this.shot.current;
    // reflection calculation
    const reflect = velocity
        .sub(normal.mul(2 * velocity.dot(normal)));
    // offset calculation - move projectile outside of the ground
    const displace = normal
        .mul(Math.max(...this.shot.shape.getBoundingBox().size) / 2);
    return { reflect, displace }
}

// should be bound to ShotStage
// applies blasts from this.userData.hitbox, if any exist.
export function createBlasts () {
    if (this.userData?.hitbox?.length)
        for (const blast of this.userData.hitbox)
            this.applyBlast(blast);
}