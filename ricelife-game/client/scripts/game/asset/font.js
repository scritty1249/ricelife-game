import { TrackableObject } from "../utils/utils.js";

// FontFace wrapper, compatible with AssetPool
export class LoadFont extends TrackableObject {
    #ready = false;
    #fontFace;
    constructor (family, src) {
        super();
        this.#fontFace = new FontFace(family, `url(${src})`);
        this.#fontFace.load()
            .then(() => document.fonts.add(this.#fontFace))
            .then(() => this.#ready = true);
    }

    get isLoadFont () { return true }
    get ready () { return this.#ready }
    get onload () { return this.#fontFace.loaded }
    get family () { return this.#fontFace.family }
    get font () { return this.#fontFace }
}