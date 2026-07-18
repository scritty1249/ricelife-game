import { BoundingBox, Vector, Path, Polygon } from "../geometry/geometry.js";
import { Properties } from "../projectile/projectile.js";

export function createTerrain (dataIterator) {
    const plane = new BoundingBox();
    const path = new Path();
    plane.max.apply(dataIterator.next().value, dataIterator.next().value);
    let result = dataIterator.next();
    let maxX = result.value;
    while (!result.done) {
        const x = result.value;
        if (x > maxX) maxX = x;
        result = dataIterator.next();
        const y = result.value;
        path.push(new Vector(x, y));
        result = dataIterator.next();
    }
    const rightBound = new Vector(maxX, 0);
    const leftBound = new Vector(0, 0);

    const p1 = path.at(-2);
    const p2 = path.at(-1);

    if (!p1.eq(rightBound)) path.push(rightBound);
    if (!p2.eq(leftBound)) path.push(leftBound);

    const terrain = new Polygon(path);
    terrain.userData.collision = Properties.DESTRUCTION | Properties.ENTER | Properties.TERRAIN;
    return { plane, terrain };
};
