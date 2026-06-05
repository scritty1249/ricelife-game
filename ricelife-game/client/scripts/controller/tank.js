import { Vector, Direction } from "../geometry/geometry.js";
import { deg2rad, TrackableObject } from "../utils/utils.js";

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
            body: 0,
            barrel: 0,
        };
        this.offset = {
            barrel: new Vector(),
            body: new Vector()
        }
        this.position = position;
    }

    #drawBarrel (cursor) { // barrel assumed to be pointed UP
        const barrel = this.#source.barrel;
        cursor.save();
        cursor.translate(this.position.add(this.offset.barrel));
        cursor.rotate(-deg2rad(this.rotation.barrel % 360));
        cursor.drawImage(barrel.img, -barrel.width / 2, 0, barrel.width, barrel.height); // pivot around bottom-center of image
        cursor.restore();
    }

    #drawBody (cursor) { // [!] repetitive?
        const body = this.#source.body;
        cursor.save();
        cursor.translate(this.position.add(this.offset.body));
        cursor.rotate(-deg2rad(this.rotation.body));
        cursor.drawImage(body.img, -body.width / 2, -body.height / 2, body.width, body.height); // pivot around center-center of image
        cursor.restore();
    }

    draw (cursor) {
        this.#drawBarrel(cursor);
        this.#drawBody(cursor);
    }

    get relativePosition () { return this.position.add(this.offset.body) }
    get width () { return this.#source.body.width }
    get height () { return this.#source.body.height }
    get barrelPos () { // gets coord at tip of barrel
        const origin = this.position.add(this.offset.barrel);
        const angle = deg2rad(this.rotation.barrel + 270);
        return origin.project(angle, this.#source.barrel.height);
    }
}