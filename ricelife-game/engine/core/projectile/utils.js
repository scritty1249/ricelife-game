import { Vector } from "../math/Vector.js";
import { Mover } from "../player/Mover.js";
import { Properties } from "./collision/Properties.js";

export function traceAmmo (
    ammoType, // constructor
    params, // Array
    increment, // Float
    limit, // Float
    collisions // [...Polygon]
) {
    const ammo = ammoType.encode(...params);
    for (const collisionPoly of collisions) ammo.colliders.push(collisionPoly);
    ammo.applyDestruction = true;
    const terrainPoly = ammo.colliders.find(({userData}) => userData.collision & Properties.TERRAIN);
    const originalHoleCount = terrainPoly.holes.length;
    const playerPolys = ammo.colliders.filter(({userData}) => userData.collision & Properties.PLAYER);
    playerPolys.forEach(({userData}) => {
        userData.position = Vector.fromObject(userData.position);
    });
    const result = { finished: false, time: limit };
    let blastsCount;
    terrainPoly.updateEdges(true);
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
        // update player hitboxes
        // [!] does not track if player dies. Need to do that - KT
        if (playerPolys.length && ammo.blasts.length !== blastsCount) { // why would there ever be less?
            const newBlasts = ammo.blasts.slice(blastsCount);
            for (const player of playerPolys) {
                if (!newBlasts.some((b) => b.shape.isIntersecting(player))) continue;
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
    }
    result.legend = ammo.getLegend(); // [!] no need to pass as transfer, we shouldn't have a large amount of collisions
    result.blasts = ammo.blasts.map((blast) => blast.decode());
    if (terrainPoly.holes.length > originalHoleCount)
        terrainPoly.holes.splice(originalHoleCount, terrainPoly.holes.length - originalHoleCount);
    return result;
}