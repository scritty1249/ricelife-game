import { Vector, Direction } from "../geometry/geometry.js";
import { deg2rad, rad2deg, TrackableObject } from "../utils/utils.js";

export class TankController extends TrackableObject {
    #source;
    constructor (bodyImage, barrelImage, position = new Vector()) {
        super();
        this.#source = {
            // expects LOADED ResizedImage objects
            body: bodyImage,
            barrel: barrelImage
        };
        this.rotation = {
            get body () { return rad2deg(bodyImage.rotation) },
            get barrel () { return rad2deg(barrelImage.rotation) },
            set body (degrees) {
                bodyImage.rotation = deg2rad(degrees);
                return degrees;
            },
            set barrel (degrees) {
                barrelImage.rotation = deg2rad(degrees);
                return degrees;
            }
        };
        this.offset = {
            barrel: new Vector(0, bodyImage.height / 2),
            body: new Vector(0, bodyImage.height / 2)
        }
        this.position = position;

        bodyImage.origin.apply(-bodyImage.width / 2, -bodyImage.height / 2);
        barrelImage.origin.apply(-barrelImage.width / 2, 0);
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

    get relativePosition () { return this.position.add(this.offset.body) }
    get width () { return this.#source.body.size.x }
    get height () { return this.#source.body.size.y }
    get barrelPos () { // gets coord at tip of barrel
        const origin = this.position.add(this.offset.barrel);
        const angle = deg2rad(this.rotation.barrel + 270);
        return origin.project(angle, this.#source.barrel.size.y);
    }
}