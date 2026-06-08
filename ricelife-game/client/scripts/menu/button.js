import { TrackableObject } from "../utils/utils.js";
import { Vector } from "../geometry/geometry.js";

export class Button extends TrackableObject {
    #img
    #boundingBoxSize = new Vector(); // can be cropped
    #callback = {
        // these need to be set as non-functions by default for isSupported checks to work
        onclick: undefined,
        onhold: undefined,
        ondrag: undefined
    };
    constructor (image) {
        super();
        this.#img = image;
        this.position = new Vector();
        this.#boundingBoxSize.apply(this.#img.size);
    }

    draw (cursor) { this.#img.draw(cursor, this.position.x, this.position.y) }
    isOver (point) { // expects global space coordinates
        const { x, y } = point;
        return (
            x >= this.position.x &&
            x <= this.position.x + this.boundingBoxSize.x &&
            y <= this.position.y &&
            y >= this.position.y - this.boundingBoxSize.y
        );
    }

    get isButton () { return true }
    get source () { return this.#img }
    get boundingBoxSize () { return this.#boundingBoxSize }
    get width () { return this.#img.width }
    get height () { return this.#img.height }
    get onclick () { return this.#callback.onclick }
    set onclick(callbackFn) { return (this.#callback.onclick = callbackFn) }
    get onhold () { return this.#callback.onhold }
    set onhold(callbackFn) { return (this.#callback.onhold = callbackFn) }
    get ondrag () { return this.#callback.ondrag }
    set ondrag(callbackFn) { return (this.#callback.ondrag = callbackFn) }
}
