import { TrackableObject } from "../utils/utils.js";
import { Vector } from "../geometry/geometry.js";

export class Button extends TrackableObject {
    #img
    #listeningTo;
    #boundingBoxSize = new Vector(); // can be crapped
    constructor (image) {
        super();
        this.#img = image;
        this.position = new Vector();
        this.#boundingBoxSize.apply(this.#img.size);
    }

    draw (cursor) { this.#img.draw(cursor, this.position.x, this.position.y, true) }
    isOver (point) { // expects global space coordinates
        const { x, y } = point;
        return (
            x >= this.position.x &&
            x <= this.position.x + this.boundingBoxSize.x &&
            y <= this.position.y &&
            y >= this.position.y - this.boundingBoxSize.y
        );
    }
    onclick (point) {
        console.info(`[Button] ${this.id}: clicked`);
    }
    
    get isButton () { return true }
    get source () { return this.#img }
    get boundingBoxSize () { return this.#boundingBoxSize }
    get listeningTo () { return this.#listeningTo }
    get width () { return this.#img.width }
    get height () { return this.#img.height }
}
