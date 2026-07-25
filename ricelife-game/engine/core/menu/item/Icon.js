import { BoundingBox } from "../../geometry/BoundingBox.js";
import { Vector } from "../../math/Vector.js";
import { TrackableObject } from "../../utils/tracking/TrackableObject.js";
import { typeString } from "../../utils/logging.js";

export class Icon extends TrackableObject {
    #img;
    #hash;
    #bbox = new BoundingBox();
    #position = new Vector();
    constructor (image) {
        super();
        if (!image?.isLoadImage) throw new Error(`[${typeString(this)}]: Expected LoadImage, got ${typeString(image)}`);
        this.#img = image;
        this.#bbox.apply(undefined, this.#img.size);
    }

    draw (cursor) {
        this.#img.draw(cursor, this.position.x, this.position.y);
    }
    getBoundingBox () {
        const hash = Vector.hash([this.position, this.#img.size]);
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

    get isIcon () { return true }
    get source () { return this.#img }
    get width () { return this.#img.width }
    get height () { return this.#img.height }
    get position () { return this.#position }
}
