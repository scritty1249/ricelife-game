import { Identifiable } from "../utils/tracking/Identifiable.js";
import { BoundingBox } from "../geometry/BoundingBox.js";
import { Vector } from "../math/Vector.js";
import { Hitbox } from "../geometry/Hitbox.js";
import { clamp } from "../math/utils.js";

export class Puppet extends Identifiable {
    #source;
    #hitboxHash;
    #bboxHash;
    #bbox;
    #hitbox;
    constructor (bodyImage, barrelImage, position = new Vector()) {
        super();
        this.#source = {
            // expects LoadImage objects
            body: bodyImage,
            barrel: barrelImage
        };
        this.rotation = {
            get body () { return bodyImage.rotation },
            get barrel () { return barrelImage.rotation - Math.PI },
            set body (radians) {
                const val = clamp(radians % (Math.PI * 2), -(Math.PI / 2), Math.PI / 2);
                bodyImage.rotation = val;
                return val;
            },
            set barrel (radians) {
                barrelImage.rotation = radians + Math.PI;
                return radians;
            }
        };
        this.offset = {
            barrel: new Vector(0, bodyImage.height * 0.74),
            body: new Vector(0, bodyImage.height / 2)
        }
        this.position = position;

        bodyImage.origin.apply(bodyImage.rawSize.x / 2, bodyImage.rawSize.y / 2); // pivot around middle-center of image
        barrelImage.origin.apply(barrelImage.rawSize.x / 2, barrelImage.rawSize.y); // pivot around bottom-center of image
    }

    #drawPart (cursor, source, offset) {
        const position = this.position.add(offset);
        source.draw(cursor, position.x, position.y);
    }

    draw (cursor, flipBody = false, flipBarrel = false) {
        if (flipBarrel) this.#source.barrel.scale.x *= -1;
        if (flipBody) this.#source.body.scale.x *= -1;
        this.#drawPart(cursor, this.#source.barrel, this.offset.barrel);
        this.#drawPart(cursor, this.#source.body, this.offset.body);
        if (flipBarrel) this.#source.barrel.scale.x *= -1;
        if (flipBody) this.#source.body.scale.x *= -1;
    }
    getHitbox () {
        const hash = Vector.hash([Vector.fromAngle(this.rotation.body), this.position]);
        if (this.#hitboxHash === hash) return this.#hitbox;
        this.#hitboxHash = hash;
        const edges = this.#source.body.getEdges(this.position.x, this.position.y);
        this.#hitbox = new Hitbox(...edges.map((edge) => edge.add(this.offset.body)));
        return this.#hitbox;
    }
    getBoundingBox () {
        const hash = Vector.hash([Vector.fromAngle(this.rotation.body), this.position]);
        if (this.#bboxHash === hash) return this.#bbox;
        this.#bboxHash = hash;
        this.#bbox = BoundingBox.fromHitbox(this.getHitbox());
        return this.#bbox;
    }

    get isPuppet () { return true }
    get relativePosition () { return this.position.add(this.offset.body) }
    get width () { return this.#source.body.size.x }
    get height () { return this.#source.body.size.y }
    get barrelPosition () { // gets coord at tip of barrel
        const origin = this.position.add(this.offset.barrel);
        const angle = this.rotation.barrel + (3 * (Math.PI / 2));
        return origin.project(angle, this.#source.barrel.size.y);
    }
}