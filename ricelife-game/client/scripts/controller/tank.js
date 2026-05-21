import { Vector, Direction } from "../geometry/vector.js";
import { deg2rad, TrackableObject } from "../utils.js";

export class TankController extends TrackableObject {
    #source;
    constructor (bodyImage, barrelImage, position = new Vector(), barrelOffset = new Vector()) {
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
        this.barrelOffset = barrelOffset;
        this.position = position;
    }

    #drawBarrel (ctx) { // barrel assumed to be pointed UP
        const barrel = this.#source.barrel;
        ctx.save();
        ctx.translate(this.position.x, this.position.y + this.barrelOffset);
        ctx.rotate(deg2rad(this.rotation.barrel % 360));
        ctx.drawImage(barrel.img, -barrel.width / 2, -barrel.height, barrel.width, barrel.height); // pivot around bottom-center of image
        ctx.restore();
    }

    #drawBody (ctx) { // [!] repetitive?
        const body = this.#source.body;
        ctx.save();
        ctx.translate(...this.position);
        ctx.rotate(deg2rad(this.rotation.body));
        ctx.drawImage(body.img, -body.width / 2, -body.height, body.width, body.height); // pivot around bottom-center of image
        ctx.restore();
    }

    draw (ctx) {
        this.#drawBarrel(ctx);
        this.#drawBody(ctx);
    }

    get width () {
        return this.#source.body.width;
    }

    get barrelPos () { // gets coord at tip of barrel
        const origin = new Vector(this.position.x, this.position.y + this.barrelOffset);
        const angle = deg2rad(this.rotation.barrel + 270);
        return origin.project(angle, this.#source.barrel.height);
    }
}