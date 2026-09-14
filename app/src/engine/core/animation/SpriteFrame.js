import { Vector } from "../math/Vector.js";

export class SpriteFrame {
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
