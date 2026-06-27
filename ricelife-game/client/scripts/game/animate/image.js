import { Vector, Path } from "../geometry/geometry.js";
import { TrackableObject, drawLine } from "../utils/utils.js";

export class LoadImage extends TrackableObject {
    #src; // used for cloning
    #img;
    #loadPromise;
    #ready = false;
    #size = new Vector();
    #origin = new Vector();
    #scale = new Vector(1, 1);
    rotation = 0; // radians
    constructor (src) {
        super();
        if (src?.isLoadImage) { // use as reference
            this.#ready = src.ready;
            if (this.#ready) {
                this.#img = src.img;
                this.#size.apply(this.#img.width, this.#img.height);
            } else {
                this.#loadPromise = src.onload.then(() => {
                    this.#src = src.img.src;
                    this.#img = src.img;
                    this.#size.apply(this.#img.width, this.#img.height);
                    this.#ready = true;
                    return this;
                });
            }
        } else {
            this.#src = src;
            this.#img = new Image();
            this.#loadPromise = new Promise((resolve, reject) => {
                this.#img.onerror = (e) => (this.#ready = undefined, reject(e));
                this.#img.onload = () => {
                    this.#size.apply(this.#img.width, this.#img.height);
                    this.#ready = true;
                    resolve(this);
                };
            });
            this.#img.src = src;
        }
    }

    draw (cursor, dx, dy, normalize = true) {
        this.drawCrop(cursor, dx, dy, this.size.x, this.size.y, 0, 0, this.#size.x, this.#size.y, this.#origin, normalize);
    }
    drawCrop (cursor, dx, dy, dWidth, dHeight, sx, sy, sWidth, sHeight, origin, normalize = true) {
        cursor.save();
        const cos = Math.cos(-this.rotation);
        const sin = Math.sin(-this.rotation);
        cursor.setTransform(cos, sin, -sin, cos, dx, normalize ? cursor.normalizeY(dy) : dy);
        const og = origin.mul(-1).mul(this.scale);
        cursor.drawImage(this.img, sx, sy, sWidth, sHeight, og.x, og.y, dWidth, dHeight);
        cursor.restore();
    }
    getEdges (x, y) {
        const { width, height } = this;
        const og = this.origin.mul(-1).mul(this.scale, true);

        const local = new Array(
            og.clone(), // top left
            new Vector(og.x + width, og.y), // top right
            new Vector(og.x + width, og.y + height), // bottom right
            new Vector(og.x, og.y + height) // bottom left
        );
        const dest = new Vector(x, y);
        local.forEach((pt) => pt.rotate(-this.rotation, true).add(dest, true));
        return local;
    }
    clone (deep = false) { return new LoadImage(deep ? this.#src : this) }

    get isLoadImage () { return true }
    get ready () { return this.#ready }
    get size () { return this.#size.mul(this.#scale) } // scaled
    get rawSize () { return this.#size }
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
    get origin () { return this.#origin }
}
