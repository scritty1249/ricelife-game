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
            barrel: new Vector(0, bodyImage.height / 2),
            body: new Vector(0, bodyImage.height / 2)
        }
        this.position = position;
    }

    #drawBarrel (cursor) { // barrel assumed to be pointed UP
        const { barrel } = this.#source;
        cursor.save();
        cursor.translate(this.position.add(this.offset.barrel));
        cursor.rotate(-deg2rad(this.rotation.barrel % 360));

        barrel.draw(cursor, -barrel.width / 2, 0);
        // cursor.drawImage(barrel.img, -barrel.size.x / 2, 0, barrel.size.x, barrel.size.y); // pivot around bottom-center of image
        cursor.restore();
    }

    #drawBody (cursor) { // [!] repetitive?
        const { body } = this.#source;
        cursor.save();
        cursor.translate(this.position.add(this.offset.body));
        cursor.rotate(-deg2rad(this.rotation.body));
        body.draw(cursor, -body.width / 2, -body.height / 2);

        // cursor.drawImage(body.img, -body.width / 2, -body.height / 2, body.size.x, body.size.y); // pivot around center-center of image
        cursor.restore();
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