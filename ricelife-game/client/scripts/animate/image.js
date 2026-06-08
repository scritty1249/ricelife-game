import { Vector } from "../geometry/geometry.js";
import { TrackableObject, drawLine } from "../utils/utils.js";

export class LoadImage extends TrackableObject {
    #img;
    #loadPromise;
    #ready = false;
    #size = new Vector();
    #scale = new Vector(1, 1);
    constructor (src) {
        super();
        if (src?.isLoadImage) { // use as reference
            this.#ready = src.ready;
            if (this.#ready) {
                this.#img = src.img;
                this.#size.apply(this.#img.width, this.#img.height);
            } else {
                this.#loadPromise = src.onload.then(() => {
                    this.#ready = true;
                    this.#img = src.img;
                    this.#size.apply(this.#img.width, this.#img.height);
                    resolve(this);
                });
            }
        } else {
            this.#img = new Image();
            this.#loadPromise = new Promise((resolve, reject) => {
                this.#img.onerror = (e) => (this.#ready = undefined, reject(e));
                this.#img.onload = () => {
                    this.#ready = true;
                    this.#size.apply(this.#img.width, this.#img.height);
                    resolve(this);
                };
            });
            this.#img.src = src;
        }
    }

    draw (cursor, dx, dy, normalize = false) {
        normalize
            ? cursor.drawImage(this.img, 0, 0, this.#size.x, this.#size.y, dx, cursor.normalizeY(dy), this.size.x, this.size.y)
            : cursor.drawImage(this.img, 0, 0, this.#size.x, this.#size.y, dx, dy, this.size.x, this.size.y);
        }
    clone () { return new LoadImage(this) }

    get isLoadImage () { return true }
    get ready () { return this.#ready }
    get size () { return this.#size.mul(this.#scale) } // scaled
    get scale () { return this.#scale }
    get onload () { return this.#ready ? Promise.resolve(this) : this.#loadPromise }
    get img () {
        if (!this.#ready)
            throw new Error(`[${this.constructor.name}] Error: Cannot access image - not loaded`);
        return this.#img;
    }
    // applying proportional transformations
    get width () { return this.size.x } // scaled
    get height () { return this.size.y } // scaled
    set width (pixels) {
        const { width } = this.img,
            scale = (pixels / width);
        this.scale.apply(scale);
        return pixels;
    }
    set height (pixels) {
        const { height } = this.img,
            scale = (pixels / height);
        this.scale.apply(scale);
        return pixels;
    }
}
