import { LoadImage } from "../asset/asset.js";

// wraps player model (image) data. Is not responsible for drawing model
export class PlayerModel {
    #type;
    #body;
    #barrel;
    // LoadedImage, LoadedImage
    // parameters should be passed in by reference
    constructor (type) {
        this.#type = type;
    }

    async load (body, barrel) {
        this.#body = body.clone(false);
        this.#barrel = barrel.clone(false);
        return await this.onload;
    }

    get isPlayerModel () { return true }
    get body () { return this.#body }
    get barrel () { return this.#barrel }
    get type () { return this.#type }
    get onload () { return Promise.all([this.body.onlaod, this.barrel.onload]).then(() => this) }
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
