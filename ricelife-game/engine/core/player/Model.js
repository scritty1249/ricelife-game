import { Loadable } from "../load/Loadable.js";

// wraps player model (image) data. Is not responsible for drawing model
export class Model extends Loadable {
    #type;
    #loadPromise;
    #body;
    #barrel;
    #source;
    #ready = false;
    // parameters should be passed in by reference
    constructor (type, body, barrel) {
        this.#type = type;
        this.#body = body.clone(false);
        this.#barrel = barrel.clone(false);
        const self = this;
        this.#source = {
            get body () { return self.body.source },
            get barrel () { return self.barrel.source }
        };
        this.#loadPromise = Promise.all([this.source.body.onload, this.source.barrel.onload])
            .then(() => this.#ready = true)
            .then(() => this);
    }

    get isModel () { return true }
    get ready () { return this.#ready }
    get source () { return this.#source }
    get onload () { return this.#loadPromise }
    get body () { return this.#body }
    get barrel () { return this.#barrel }
    get type () { return this.#type }
    get width () { return this.body.width }
    set width (pixels) {
        this.body.width = pixels;
        this.barrel.scale.apply(this.body.scale);
        return pixels;
    }
    get height () { return this.body.height }
    set height (pixels) {
        this.body.height = pixels;
        this.barrel.scale.apply(this.body.scale);
        return pixels;
    }
}
