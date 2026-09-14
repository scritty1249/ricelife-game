import { Path } from "./Path.js";

export class Ray extends Path {
    constructor (origin, direction, distance = undefined) {
        if (distance === undefined) super(origin, direction);
        else super(origin, origin.add(direction.mul(distance)));
    }

    get isRay () { return true }
}
