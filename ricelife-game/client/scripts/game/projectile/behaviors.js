// reusable collision behaviors

// should be bound to ShotStage
// computes bounce trajectory and return with related math
// returns undefined if no bounce
export function computeBounce () {
    const { shot } = this;
    const { normal, position, direction: dir } = this.lastCollision;
    if (normal) {
        // reflection calculation
        const direction = dir.mul(shot.speed);
        const reflection = direction
            .sub(normal.mul(2 * direction.dot(normal)));
        return { direction, normal, reflection, point: shot.position.clone() }; // debugging, record bounce calculations
    }
    return undefined;
}

// should be bound to ShotStage
// applies blasts from this.userData.hitbox, if any exist.
export function createBlasts () {
    if (this.userData?.hitbox?.length)
        for (const blast of this.userData.hitbox)
            this.applyBlast(blast);
}