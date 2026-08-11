import { LoadImage } from "./LoadImage.js";
import { Color } from "../math/Color.js";
import { Vector } from "../math/Vector.js";

export class EditableImage extends LoadImage {
    #canvas = new OffscreenCanvas(0, 0);
    #ctx;
    #ready = false;
    #size = new Vector();
    #loadPromise = Promise.withResolvers();
    constructor (src) {
        super(src);
        this.#ctx = this.#canvas.getContext("2d");
        super.onload.then(() => {
            const { width, height } = super.source;
            this.#size.x = this.#canvas.width = width;
            this.#size.y = this.#canvas.height = height;
            this.#ctx.drawImage(super.source, 0, 0);
            this.#ready = true;
            this.#loadPromise.resolve(this);
        })
        .catch((err) => this.#loadPromise.reject(err));
    }

    get isEditableImage () { return true }
    get source () { return this.#canvas }
    get ready () { return this.#ready }
    get onload () { return this.#loadPromise.promise }
    get rawSize () { return this.#size }
    get imageData () { return this.#ctx.getImageData(0, 0, this.rawSize.x, this.rawSize.y) }
    set imageData (imgData) {
        this.#ctx.putImageData(imgData, 0, 0);
        return imgData;
    }
}
