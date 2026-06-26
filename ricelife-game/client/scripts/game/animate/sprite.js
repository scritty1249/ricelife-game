import { Vector } from "../geometry/geometry.js";
import { LoadImage } from "./image.js";

export class Spritesheet extends LoadImage {
    #frameSize = new Vector();
    #dimensions = new Vector();
    #length;
    #frames = [];
    #offset = new Vector(); // offset is applied using canvas coordinates (0,0) is top left, offset is applied before scaling
    #framerate; // completely optional. Only used to associate a consistet value with this specific source, it should not be used or interacted with at all within this class.
    constructor (src, frameWidth, frameHeight, offset = new Vector(), framerate = undefined) {
        super(src);
        this.#offset.apply(offset);
        this.#framerate = framerate;
        this.#frameSize.x = frameWidth;
        this.#frameSize.y = frameHeight;
        {
            // idiot proofing
            const mod = this.size.mod(this.#frameSize);
            if (!(mod.x === 0 && mod.y === 0)) throw new Error(`[${this.constructor.name}] Error: Image dimensions incompatible with frame size`);
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
    clone () { // clones by reference
        const ss = new Spritesheet(this, this.#frameSize.x, this.#frameSize.y, this.#offset);
        ss.origin.apply(this.origin);
        ss.scale.apply(this.scale);
        ss.rotation = this.rotation;
        ss.framerate = this.framerate;
        return ss;
    }

    get offset () { return this.#offset } // raw offset. Scaled offset can be found in the individual frames. [!] is this too convoluted?
    get frameSize () { return this.#frameSize } // raw size. Scaled size can be found in the individual frames. [!] is this too convoluted?
    get length () { return this.#length }
    get isSpritesheet () { return true }
    get framerate () { return this.#framerate }
    set framerate (frames) { return (this.#framerate = frames) }
}

class SpriteFrame {
    #spritesheet;
    constructor (x, y, spritesheet) {
        this.framePosition = new Vector(x, y);
        this.#spritesheet = spritesheet;
    }

    draw (cursor, position) {
        const { framePosition, size, offset, origin } = this,
            { frameSize } = this.#spritesheet;
        const offsetPosition = position.add(offset);
        this.#spritesheet.drawCrop(cursor, offsetPosition.x, offsetPosition.y, size.x, size.y, framePosition.x, framePosition.y, frameSize.x, frameSize.y, origin);
    }

    get isSpriteFrame () { return true }
    get offset () { return this.#spritesheet.offset.mul(this.#spritesheet.scale) }
    get size () { return this.#spritesheet.frameSize.mul(this.#spritesheet.scale) }
    get origin () {
        return this.#spritesheet.origin
            .div(this.#spritesheet.rawSize)
            .mul(this.#spritesheet.frameSize);
    }
    get spritesheet () { return this.#spritesheet } // [!] might be redundant, since these are only supposed to exist attached to Spritesheets
}
