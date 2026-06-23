import { TrackableObject, floatEqual } from "../utils/utils.js";
import { Vector, Color } from "../geometry/geometry.js";

export class Icon extends TrackableObject {
    #img
    #boundingBoxSize = new Vector(); // can be cropped
    #fontColor = new Color(0, 0, 0);
    text = "";
    fontSize = 24;
    fontFamily = "Arial";
    constructor (image) {
        super();
        this.#img = image;
        this.position = new Vector();
        this.#boundingBoxSize.apply(this.#img.size);
    }

    draw (cursor) {
        this.#img.draw(cursor, this.position.x, this.position.y);
        this.#drawText(cursor);
    }

    #drawText (cursor) {
        if (floatEqual(this.fontColor.a, 0) || !this.text) return;
        cursor.save();
        cursor.font = `bold ${this.fontSize}px ${this.fontFamily}`;
        cursor.fillStyle = this.fontColor.toString();
        cursor.textAlign = "center";
        cursor.textBaseline = "middle";

        // 4. Draw the text using the calculated center coordinates
        cursor.fillText(this.text, this.position.x + (this.width / 2), this.position.y - (this.height / 2));
        cursor.restore();
    }

    isOver (point) { // expects global space coordinates
        const { x, y } = point;
        return (
            x >= this.position.x &&
            x <= this.position.x + this.boundingBoxSize.x &&
            y <= this.position.y &&
            y >= this.position.y - this.boundingBoxSize.y
        );
    }

    get isIcon () { return true }
    get source () { return this.#img }
    get boundingBoxSize () { return this.#boundingBoxSize }
    get width () { return this.#img.width }
    get height () { return this.#img.height }
    get fontColor () { return this.#fontColor }
}

export class Button extends Icon {
    #callback = {
        // these need to be set as non-functions by default for isSupported checks to work
        onclick: undefined,
        onhold: undefined,
        ondrag: undefined
    };
    constructor (image) {
        super(image);
    }

    get onclick () { return this.#callback.onclick }
    set onclick(callbackFn) { return (this.#callback.onclick = callbackFn) }
    get onhold () { return this.#callback.onhold }
    set onhold(callbackFn) { return (this.#callback.onhold = callbackFn) }
    get ondrag () { return this.#callback.ondrag }
    set ondrag(callbackFn) { return (this.#callback.ondrag = callbackFn) }
}
