import { Vector, Hitbox } from "../geometry/geometry.js";
import { deg2rad, rad2deg, clamp } from "../utils/utils.js";

export class TankController {
    #source;
    #hitboxHash;
    #hitbox;
    constructor (bodyImage, barrelImage, position = new Vector()) {
        this.#source = {
            // expects LOADED ResizedImage objects
            body: bodyImage,
            barrel: barrelImage
        };
        this.rotation = {
            get body () { return bodyImage.rotation },
            get barrel () { return barrelImage.rotation - (Math.PI) },
            set body (radians) {
                const val = clamp(radians % (Math.PI * 2), -(Math.PI / 2), Math.PI / 2);
                bodyImage.rotation = val;
                return val;
            },
            set barrel (radians) {
                barrelImage.rotation = radians + (Math.PI);
                return radians;
            }
        };
        this.offset = {
            barrel: new Vector(0, bodyImage.height / 2),
            body: new Vector(0, bodyImage.height / 2)
        }
        this.position = position;

        bodyImage.origin.apply(bodyImage.rawSize.x / 2, bodyImage.rawSize.y / 2); // pivot around middle-center of image
        barrelImage.origin.apply(barrelImage.rawSize.x / 2, barrelImage.rawSize.y); // pivot around bottom-center of image
    }

    #drawBarrel (cursor) { // barrel assumed to be pointed UP
        const { barrel } = this.#source;
        const position = this.position.add(this.offset.barrel);
        barrel.draw(cursor, position.x, position.y);
    }

    #drawBody (cursor) { // [!] repetitive?
        const { body } = this.#source;
        const position = this.position.add(this.offset.body);
        body.draw(cursor, position.x, position.y);
    }

    draw (cursor) {
        this.#drawBarrel(cursor);
        this.#drawBody(cursor);
    }
    getHitbox () {
        const hash = Vector.hashVectors([Vector.fromAngle(this.rotation.body), this.position]);
        if (this.#hitboxHash === hash) return this.#hitbox;
        this.#hitboxHash = hash;
        const edges = this.#source.body.getEdges(this.position.x, this.position.y);
        this.#hitbox = new Hitbox(...edges.map((edge) => edge.add(this.offset.body)));
        return this.#hitbox;
    }

    get relativePosition () { return this.position.add(this.offset.body) }
    get width () { return this.#source.body.size.x }
    get height () { return this.#source.body.size.y }
    get barrelPosition () { // gets coord at tip of barrel
        const origin = this.position.add(this.offset.barrel);
        const angle = this.rotation.barrel + (3 * (Math.PI / 2));
        return origin.project(angle, this.#source.barrel.size.y);
    }
}