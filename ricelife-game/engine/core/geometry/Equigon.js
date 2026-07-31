import { Poly } from "./Poly.js";
import { Polygon } from "./Polygon.js";
import { Vector } from "../math/Vector.js";

// Equilateral Polygon 
// unoptimized, can be used to substitute other shapes or support shapes with more sides (Hexagon, Octogon, etc)
// [!] origin is at polygon center, instead of tip
export class Equigon extends Poly {
    static *#generateSides (sides, length) {
        const step = (2 * Math.PI) / sides;
        const radius = length / (2 * Math.sin(Math.PI / sides));
        for (let i = 0; i < sides; i++)
            yield Vector.fromAngle((i * step) + Math.PI / 2)
                .mul(radius, true);
    }
    #sides;
    #length;
    constructor (sides, legLength) {
        const ngon = new Polygon(...Equigon.#generateSides(sides, legLength));
        super(ngon);
        this.#sides = sides;
        this.#length = legLength;
    }

    get isEquigon () { return true }
    get sides () { return this.#sides }
    get length () { return this.#length }
}
