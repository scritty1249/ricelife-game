import { LoadImage } from "../animate/animate.js";

// wraps player model (image) data. Is not responsible for drawing model
export class PlayerModel {
    static SOURCE_TABLE = {};
    static loadSource (key) {
        const list = PlayerModel.SOURCE_TABLE;
        const body = new LoadImage(list[key].body);
        const barrel = new LoadImage(list[key].barrel)
        list[key] = { body, barrel };
    }
    static getSource (key) {
        return PlayerModel.SOURCE_TABLE[key];
    }
    static sourceLoaded (key) {
        return PlayerModel.getSource(key).body?.isLoadImage;
    }
    static sourceExists (key) {
        return key in PlayerModel.SOURCE_TABLE;
    }
    #type;
    #body;
    #barrel;
    // LoadedImage, LoadedImage
    // parameters should be passed in by reference
    constructor (type, width = 50) {
        if (!PlayerModel.sourceExists(type)) throw new Error(`[${this.constructor.name}]: Model type ${type} does not exist in source table ${Object.keys(PlayerModel.SOURCE_TABLE)?.toString()}`);
        if (!PlayerModel.sourceLoaded(type)) PlayerModel.loadSource(type);
        const { body, barrel } = PlayerModel.getSource(type);
        this.#type = type;
        this.#body = body.clone(false);
        this.#barrel = barrel.clone(false);
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
