import { BoundingBox } from "../../geometry/BoundingBox.js";
import { Color } from "../../math/Color.js";
import { Vector } from "../../math/Vector.js";
import { equals } from "../../math/utils.js";
import { TrackableObject } from "../../utils/tracking/TrackableObject.js";

export class Button extends TrackableObject {
    // these need to be set as non-functions by default for isSupported checks to work
    // all given parameters are Vectors
    #callback = {
        // (position, delta)
        onclick: undefined,
        // (position)
        onhold: undefined,
        // (position, origin, delta)
        ondrag: undefined,
        // (position)
        onpress: undefined,
        // (position, delta)
        // delta is calculated from pressed position
        onrelease: undefined,
        // (position, delta)
        // position is where the pointer is while scrolled
        // delta is scrolled amount
        onscroll: undefined
    };
    #fontColor = new Color(0, 0, 0, 1);
    fontSize = 24;
    fontFamily = "Arial";
    text = "";
    keepDragFocus = false; // when set, drag events will continue even after pointer leaves this button's area
    constructor () {
        super();
    }

    draw (cursor, fixed) {
        this.drawButton(cursor, fixed);
        this.drawText(cursor, undefined, fixed);
    }
    drawText (cursor, offset = undefined, fixed = false) {
        if (equals(this.fontColor.a, 0) || !this.text) return;
        cursor.save();
        cursor.fixed = fixed;
        cursor.font = `bold ${this.fontStyle}`;
        cursor.fillStyle = this.fontColor.toString();
        cursor.textAlign = "center";
        cursor.textBaseline = "middle";
        const position = this.getPosition(); // clone
        if (offset?.isVector)
            position.add(offset, true);
        cursor.fillText(this.text, position);
        cursor.restore();
    }

    get isButton () { return true }
    get onclick () { return this.#callback.onclick }
    set onclick (callbackFn) { return (this.#callback.onclick = callbackFn) }
    get onhold () { return this.#callback.onhold }
    set onhold (callbackFn) { return (this.#callback.onhold = callbackFn) }
    get ondrag () { return this.#callback.ondrag }
    set ondrag (callbackFn) { return (this.#callback.ondrag = callbackFn) }
    get onpress () { return this.#callback.onpress }
    set onpress (callbackFn) { return (this.#callback.onpress = callbackFn) }
    get onrelease () { return this.#callback.onrelease }
    set onrelease (callbackFn) { return (this.#callback.onrelease = callbackFn) }
    get onscroll () { return this.#callback.onscroll }
    set onscroll (callbackFn) { return (this.#callback.onscroll = callbackFn) }

    // [!] should be overridden by children
    drawButton (cursor, fixed = false) {}
    isOver (point) { return false }
    getBoundingBox () { return new BoundingBox() }
    setPosition (x, y = null) {}
    getPosition () { return new Vector() }
    get width () { return 0 }
    get height () { return 0 }
    get fontColor () { return this.#fontColor }
    get fontStyle () { return `${this.fontSize}px ${this.fontFamily}` }
}