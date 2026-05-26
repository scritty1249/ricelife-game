import { Vector, Direction } from "../geometry/vector.js";
import { deg2rad, TrackableObject } from "../utils.js";

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

    #drawBarrel (ctx) { // barrel assumed to be pointed UP
        const barrel = this.#source.barrel;
        ctx.save();
        ctx.translate(...this.position.add(this.offset.barrel));
        ctx.rotate(deg2rad(this.rotation.barrel % 360));
        ctx.drawImage(barrel.img, -barrel.width / 2, -barrel.height, barrel.width, barrel.height); // pivot around bottom-center of image
        ctx.restore();
    }

    #drawBody (ctx) { // [!] repetitive?
        const body = this.#source.body;
        ctx.save();
        ctx.translate(...this.position.add(this.offset.body));
        ctx.rotate(deg2rad(this.rotation.body));
        ctx.drawImage(body.img, -body.width / 2, -body.height / 2, body.width, body.height); // pivot around center-center of image
        ctx.restore();
    }

    draw (ctx) {
        this.#drawBarrel(ctx);
        this.#drawBody(ctx);
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