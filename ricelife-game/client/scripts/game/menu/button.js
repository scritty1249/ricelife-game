import { TrackableObject, floatEqual } from "../utils/utils.js";
import { Vector, Color, BoundingBox } from "../geometry/geometry.js";

export class Icon extends TrackableObject {
    #img;
    #hash;
    #bbox = new BoundingBox();
    #fontColor = new Color(0, 0, 0);
    text = "";
    fontSize = 24;
    fontFamily = "Arial";
    #position = new Vector();
    constructor (image) {
        super();
        this.#img = image;
        this.#bbox.apply(undefined, this.#img.size);
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

    getBoundingBox () {
        const hash = Vector.hashVectors([this.position, this.#img.size]);
        if (hash !== this.#hash) {
            this.#hash = hash;
            const { size } = this.#img;
            const min = this.position.clone();
            const max = min.clone();
            min.y -= size.y;
            max.x += size.x;
            this.#bbox.apply(min, max);
        }
        return this.#bbox;
    }

    isOver (point) {
        return this.getBoundingBox().isIntersecting(point);
    }

    get isIcon () { return true }
    get source () { return this.#img }
    get width () { return this.#img.width }
    get height () { return this.#img.height }
    get fontColor () { return this.#fontColor }
    get position () { return this.#position }
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

    get isButton () { return true }
    get onclick () { return this.#callback.onclick }
    set onclick(callbackFn) { return (this.#callback.onclick = callbackFn) }
    get onhold () { return this.#callback.onhold }
    set onhold(callbackFn) { return (this.#callback.onhold = callbackFn) }
    get ondrag () { return this.#callback.ondrag }
    set ondrag(callbackFn) { return (this.#callback.ondrag = callbackFn) }
}
