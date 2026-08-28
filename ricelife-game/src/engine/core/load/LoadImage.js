import { Path } from "../math/Path.js";
import { Vector } from "../math/Vector.js";
import { Loadable } from "./Loadable.js";
import { typeString } from "../utils/logging.js";

export class LoadImage extends Loadable {
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
                this.#img = src.source;
                this.#src = this.#img.src;
                this.#size.apply(this.#img.width, this.#img.height);
            } else {
                this.#loadPromise = src.onload.then(() => {
                    this.#src = src.source?.src;
                    this.#img = src.source;
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
    // [!] justified to top left
    drawCrop (cursor, dx, dy, dWidth, dHeight, sx, sy, sWidth, sHeight, origin, normalize = true) {
        cursor.save();
        const cos = Math.cos(-this.rotation);
        const sin = Math.sin(-this.rotation);
        cursor.transform(cos, sin, -sin, cos, dx, normalize ? cursor.normalizeY(dy) : dy);
        const fx = Math.sign(this.#scale.x) || 1;
        const fy = Math.sign(this.#scale.y) || 1;
        cursor.scale(fx, fy);
        const absScale = new Vector(Math.abs(this.#scale.x), Math.abs(this.#scale.y));
        const og = origin.mul(-1).mul(absScale, true);
        cursor.drawImage(
            this.source, 
            sx, sy, sWidth, sHeight, 
            og.x, og.y,
            Math.abs(dWidth), Math.abs(dHeight)
        );
        cursor.restore();
    }
    getEdges (x, y) {
        const { width, height } = this;
        const og = this.origin.mul(-1).mul(this.scale, true);
        if (this.#scale.x < 0) og.x = -og.x - width;
        if (this.#scale.y < 0) og.y = -og.y - height;

        const local = new Array(
            og.clone(), // top left
            new Vector(og.x + width, og.y), // top right
            new Vector(og.x + width, og.y + height), // bottom right
            new Vector(og.x, og.y + height) // bottom left
        );
        const dest = new Vector(x, y);
        local.forEach((pt) => pt.rotate(this.rotation, true).add(dest, true));
        return local;
    }
    clone (deep = false) {
        const img = new LoadImage(deep ? this.#src : this);
        img.scale.apply(this.scale);
        img.origin.apply(this.origin);
        return img;
    }

    get isLoadImage () { return true }
    get ready () { return this.#ready }
    get size () { return this.rawSize.mul(this.#scale).abs(true) } // scaled
    get rawSize () { return this.#size }
    get scale () { return this.#scale }
    get onload () { return this.#ready ? Promise.resolve(this) : this.#loadPromise }
    get source () {
        if (!this.#ready)
            throw new Error(`[${typeString(this)}] Error: Cannot access image - not loaded`);
        return this.#img;
    }
    // applies proportional transformations
    get width () { return this.size.x } // scaled
    get height () { return this.size.y } // scaled
    set width (pixels) {
        const { x, y } = this.scale;
        const scale = (pixels / this.source.width);
        this.scale.apply(scale);
        if (x < 0) this.scale.x *= -1;
        if (y < 0) this.scale.y *= -1;
        return pixels;
    }
    set height (pixels) {
        const { x, y } = this.scale;
        const scale = (pixels / this.source.height);
        this.scale.apply(scale);
        if (x < 0) this.scale.x *= -1;
        if (y < 0) this.scale.y *= -1;
        return pixels;
    }
    get origin () { return this.#origin }
}
