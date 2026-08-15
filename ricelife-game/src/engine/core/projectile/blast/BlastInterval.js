import { BoundingBox } from "../../geometry/BoundingBox.js";

export class BlastInterval {
    #blasts = new Array();
    #delay;
    #frame;
    #terrain;
    #bbox;
    #bboxes;
    constructor (delay, terrain, frame = undefined, blasts = []) {
        this.#delay = delay;
        this.#frame = frame;
        this.#terrain = terrain;
        this.#blasts.push(...blasts);
        this.#bboxes = blasts.map(({shape}) => shape.getBoundingBox());
        this.#bbox = BoundingBox.merge(this.boundingBoxes);
        Object.freeze(this.#blasts);
        Object.freeze(this.#bboxes);
    }

    get isBlastInterval () { return true }
    get blasts () { return this.#blasts }
    get delay () { return this.#delay }
    get frame () { return this.#frame }
    get terrain () { return this.#terrain }
    get boundingBox () { return this.#bbox }
    get boundingBoxes () { return this.#bboxes }
}
