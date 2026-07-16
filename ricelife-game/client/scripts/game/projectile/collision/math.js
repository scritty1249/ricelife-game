import { floatEqual } from "../../utils/math.js";

const SENTINAL_EPSILON = 0.0001;

export function getSegmentCollision (position, projected, segmentStart, segmentEnd, radius, clockwise = true, movementVector = undefined) {
    if (!position?.isVector) throw new Error(`Invalid parameter - expected Vector, got ${typeof position}`);
    if (!projected?.isVector) throw new Error(`Invalid parameter - expected Vector, got ${typeof projected}`);
    if (!segmentStart?.isVector) throw new Error(`Invalid parameter - expected Vector, got ${typeof segmentStart}`);
    if (!segmentEnd?.isVector) throw new Error(`Invalid parameter - expected Vector, got ${typeof segmentEnd}`);
    if (!Number.isFinite(radius)) throw new Error(`Invalid parameter - expected Number, got ${typeof radius}`);
    
    const move = movementVector?.isVector ? movementVector : projected.sub(position); // [!] optional parameter for optimization        
    const normal = segmentStart.normal(segmentEnd, clockwise);
    const diff = segmentStart.sub(position);
    const side = clockwise ? -1 : 1;//(clockwise ? -1 : 1) * Math.sign(diff.dot(normal));
    const offset = normal.mul(side * radius);
    const pStart = segmentStart.add(offset);
    const pEnd = segmentEnd.add(offset);
    const pDiff = pEnd.sub(pStart);
    const denom = move.cross(pDiff);
    if (Math.abs(denom) < SENTINAL_EPSILON) return null; // path and segment are parallel
    const startDiff = pStart.sub(position);
    const moveCoeff = startDiff.cross(pDiff) / denom;
    const segmentCoeff = startDiff.cross(move) / denom;
    
    if (moveCoeff > 0
        && moveCoeff < 1
        && segmentCoeff > 0
        && segmentCoeff < 1
    ) {
        const norm = normal.mul(side);
        return {
            projectedCoeff: moveCoeff,
            segmentCoeff: segmentCoeff,
            position: position.add(move.mul(moveCoeff)),
            point: projected.sub(normal.mul(radius)),
            normal: norm,
            entering: move.dot(norm) < 0
        };
    }
    let collision = getCornerCollision(position, projected, segmentStart, radius, move, diff);
    if (collision) collision.segmentCoeff = 0;
    else {
        collision = getCornerCollision(position, projected, segmentEnd, radius, move);
        if (collision) collision.segmentCoeff = 1;
    }
    return collision;
}

function getCornerCollision (position, projected, cornerPoint, radius, movementVector, toCornerVector = undefined) {
    const move = movementVector;
    const diff = toCornerVector?.isVector ? toCornerVector : cornerPoint.sub(position);
    const denom = move.dot();
    if (denom < SENTINAL_EPSILON) return null;
    const coeff = diff.dot(move) / denom;
    if (coeff >= 0 && coeff <= 1) {
        const distance = position.add(move.mul(coeff)).sub(cornerPoint, true);
        const distSq = distance.dot();
        if (distSq <= radius * radius && distSq > SENTINAL_EPSILON) {
            const d = Math.sqrt(distSq);
            const newCoeff = coeff - ((radius - d) / Math.sqrt(denom));
            if (newCoeff >= 0 && newCoeff <= 1) {
                return {
                    projectedCoeff: newCoeff,
                    position: position.add(move.mul(newCoeff)),
                    point: cornerPoint,
                    normal: diff.mul(1 / d),
                    entering: move.dot(position.sub(cornerPoint)) < 0
                };
            }
        }
    }
    return null;
}