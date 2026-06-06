import { Vector } from "../geometry/geometry.js";
import { LoadImage } from "./image.js";

export class Spritesheet extends LoadImage {
    #frameSize = new Vector();
    #dimensions = new Vector();
    #length;
    #frames = [];
    constructor (src, frameWidth, frameHeight) {
        super(src);
        this.#frameSize.x = frameWidth;
        this.#frameSize.y = frameHeight;
        {
            // idiot proofing
            const mod = this.size.mod(this.#frameSize);
            if (!(mod.x === 0 && mod.y === 0)) throw new Error("[SpriteSheet] Error: Image dimensions incompatible with frame size");
        }
        this.onload.then(() => {
            this.#dimensions.apply(
                this.img.width / this.#frameSize.x,
                this.img.height / this.#frameSize.y
            ).floor(true);
            this.#length = this.#dimensions.prod();
            // populate frames
            for (let idx = 0; idx < this.length; idx++)
                this.#frames.push(
                    new SpriteFrame(
                        (idx % this.#dimensions.x) * this.frameSize.x,
                        (Math.floor(idx / this.#dimensions.x)) * this.#frameSize.y,
                        this
                    ));
        });
    }

    at (index) { return this.#frames.at(index) }
    clone () { return new Spritesheet(this, this.#frameSize.x, this.#frameSize.y) } // clones by reference

    get frameSize () { return this.#frameSize } // raw size. Scaled size can be found in the individual frames. [!] is this too convoluted?
    get length () { return this.#length }
    get isSpritesheet () { return true }
}

class SpriteFrame {
    #spritesheet;
    constructor (x, y, spritesheet) {
        this.framePosition = new Vector(x, y);
        this.#spritesheet = spritesheet;
    }

    draw (cursor, position) {
        const { framePosition, size } = this,
            { frameSize } = this.#spritesheet;
        cursor.drawImage(this.#spritesheet.img, framePosition, frameSize, position, size);
    }

    get isSpriteFrame () { return true }
    get size () { return this.#spritesheet.frameSize.mul(this.#spritesheet.scale) }
    get spritesheet () { return this.#spritesheet } // [!] might be redundant, since these are only supposed to exist attached to Spritesheets
}
