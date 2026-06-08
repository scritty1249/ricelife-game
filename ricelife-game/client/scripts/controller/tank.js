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
            get body () { return bodyImage.rotation },
            get barrel () { return barrelImage.rotation },
            set body (radians) {
                bodyImage.rotation = radians;
                return radians;
            },
            set barrel (radians) {
                barrelImage.rotation = radians;
                return radians;
            }
        };
        this.offset = {
            barrel: new Vector(0, bodyImage.height / 2),
            body: new Vector(0, bodyImage.height / 2)
        }
        this.position = position;

        bodyImage.origin.apply(bodyImage.rawSize.x / 2, bodyImage.rawSize.y / 2); // pivot around middle-center of image
        barrelImage.origin.apply(barrelImage.rawSize.x / 2, 0); // pivot around bottom-center of image
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
        const angle = this.rotation.barrel + (3 * (Math.PI / 2));
        return origin.project(angle, this.#source.barrel.size.y);
    }
}