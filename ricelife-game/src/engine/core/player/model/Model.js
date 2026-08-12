import { Loadable } from "../../load/Loadable.js";
import { EditableImage } from "../../load/EditableImage.js";
import { ModelInfo } from "./ModelInfo.js";
import { Color } from "../../math/Color.js";
import { Puppet } from "../round/Puppet.js";

// wraps player model (image) data. Is not responsible for drawing model
export class Model extends Loadable {
    static #SRC = {
        body: "/body.png",
        barrel: "/barrel.png",
        props: "/properties.json"
    };
    static generateSources (root) {
        return {
            body: new EditableImage(root + Model.#SRC.body),
            barrel: new EditableImage(root + Model.#SRC.barrel),
            props: new ModelInfo(root + Model.#SRC.props)
        };
    }
    #loadPromise = Promise.withResolvers();
    #ready = false;
    #source = {
        body: undefined,
        barrel: undefined,
        props: undefined
    };
    #type;
    constructor (type, src = "", colorKey = {}, colorTolerance = 30) {
        super();
        if (type?.isModel) {
            this.#type = type.type;
            type.onload.then(() => {
                this.#source.body = type.body.clone(false);
                this.#source.barrel = type.barrel.clone(false);
                this.#source.props = type.props;
                this.#resolve();
            })
            .catch((err) => this.#loadPromise.reject(err));
        } else {
            this.#type = type;
            const { body, barrel, props } = Model.generateSources(src);
            Promise.all([body.onload, barrel.onload, props.onload])
                .then(async () => {
                    for (const [ target, dest ] of Object.entries(colorKey)) {
                        const oldColor = new Color(target);
                        const newColor = new Color(dest);
                        swapImageColors(body, oldColor, newColor, colorTolerance);
                        swapImageColors(barrel, oldColor, newColor, colorTolerance);
                    }
                    return Promise.all([body.Image(), barrel.Image()]);
                })
                .then(([bodyImg, barrelImg]) => {
                    this.#source.body = bodyImg;
                    this.#source.barrel = barrelImg;
                    this.#source.props = props;
                    this.#resolve();
                })
                .catch((err) => this.#loadPromise.reject(err));
        }
    }

    #resolve () {
        const { body, barrel, props } = this;
        body.origin.apply(body.rawSize.mul(props.body.origin));
        barrel.origin.apply(barrel.rawSize.mul(props.barrel.origin));
        this.#ready = true;
        this.#loadPromise.resolve(this);
    }

    Puppet () {
        const { props } = this;
        const body = this.body.clone();
        const barrel = this.barrel.clone();
        const puppet = new Puppet(body, barrel);
        puppet.offset.body.apply(body.size.mul(props.body.offset));
        puppet.offset.barrel.apply(barrel.size.mul(props.barrel.offset));
        return puppet;
    }
    clone () { return new Model(this) }

    get isModel () { return true }
    get ready () { return this.#ready }
    get source () { return this.#source }
    get onload () { return this.#loadPromise.promise }
    get body () { return this.#source.body }
    get barrel () { return this.#source.barrel }
    get props () { return this.#source.props }
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

// ignores alpha channel
function swapImageColors (editableImage, oldColor, newColor, tolerance = 0) {
    const { imageData } = editableImage;
    const { data } = imageData;
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        if (Math.abs(r - oldColor.r) <= tolerance &&
            Math.abs(g - oldColor.g) <= tolerance &&
            Math.abs(b - oldColor.b) <= tolerance
        ) {
            data[i] = newColor.r;
            data[i + 1] = newColor.g;
            data[i + 2] = newColor.b;
        }
    }
    editableImage.imageData = imageData;
}
