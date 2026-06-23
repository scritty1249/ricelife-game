// reusable collision behaviors

// should be bound to ShotStage
// computes bounce trajectory and return with related math
export function computeBounce (normal) {
    const { position, velocity } = this.shot.current;
    // reflection calculation
    return velocity
        .sub(normal.mul(2 * velocity.dot(normal)));
}

// should be bound to ShotStage
// applies blasts from this.userData.hitbox, if any exist.
export function createBlasts () {
    if (this.userData?.hitbox?.length)
        for (const blast of this.userData.hitbox)
            this.applyBlast(blast);
}