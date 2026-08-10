import { Vector } from "../math/Vector.js";
import { equals } from "../math/utils.js";
import { Mover } from "../player/Mover.js";
import { Properties } from "./collision/Properties.js";

export function traceAmmo (
    ammoType, // constructor
    params, // Array
    increment, // Float
    limit, // Float
    terrain, // Terrain
    collisions // [...Polygon]
) {
    const ammo = ammoType.encode(...params);
    // expose and seperate polygons to use in trace loop
    const terrainPoly = terrain.polygon;
    const playerPolys = collisions.filter(({userData}) => userData.collision & Properties.PLAYER);
    playerPolys.forEach(({userData}) => {
        userData.position = Vector.fromObject(userData.position);
    });
    // setup ammo colliders
    ammo.colliders.push(terrainPoly);
    for (const collisionPoly of collisions)
        ammo.colliders.push(collisionPoly);
    ammo.applyDestruction = true;
    // save polygon states to restore after trace
    const destructiblePolys = ammo.colliders.filter(({userData}) => userData.collision & Properties.DESTRUCTION);
    const originalHoleCounts = Array.from(destructiblePolys, (poly) => poly.holes.length);
    // trace ammo
    const result = { finished: false, time: limit };
    terrainPoly.updateEdges(true); // [!] doesn't register holes, or changes to the edge hashes, unless we force update here for some reason. -KT
    let terrainHash = terrainPoly.hash;
    let blastsCount;
    while (ammo.time < limit && !result.finished) {
        blastsCount = ammo.blasts.length;
        // run the trace
        ammo.update(increment);
        // check if done
        if (ammo.isFinished) {
            result.time = ammo.time;
            result.finished = true;
            break;
        }
        // update player hitboxes if terrain has changed
        // [!] does not track if player dies. Need to do that - KT
        const updatedTerrainHash = terrainPoly.hash;
        if (playerPolys.length && terrainHash !== terrainPoly.hash) {
            const newBlasts = ammo.blasts.slice(blastsCount);
            for (const player of playerPolys) {
                if (newBlasts.length && !newBlasts.some((b) => b.shape.isIntersecting(player))) continue;
                // update positioning - account for "falling"
                const { position, rotation, heightOffset } = player.userData;
                const hit = Mover.computePosition(position, heightOffset, terrainPoly);
                if (hit) {
                    const { angle, point } = hit;
                    const offset = point.sub(position);
                    player.path.forEach((pt) => pt
                        .pivot(angle - rotation, position, true)
                        .add(offset, true));
                    position.add(offset, true);
                    player.userData.rotation = angle;
                }
            }
        }
        terrainHash = updatedTerrainHash;
    }
    result.legend = ammo.getLegend(true);
    result.blasts = ammo.blasts.map((blast) => blast.encode());
    destructiblePolys.forEach((poly, i) => {
        const count = originalHoleCounts[i];
        poly.holes.splice(count, poly.holes.length - count);
    });
    return result;
}

export function sortBlastIntervals (blasts = []) {
    if (!blasts?.length) return [];
    // group blasts that occur at the same time
    const uniq = [];
    const blastIntervals = Array.from(Map.groupBy(blasts, ({delay}) => {
        const value = uniq.find((key) => equals(key, delay))
        if (value !== undefined) return value;
        uniq.push(delay);
        return delay;
    }).entries())
    .sort((a, b) => a[0] - b[0])
    .map(([_, blast]) => blast);
    return blastIntervals;
}