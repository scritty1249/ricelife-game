import { Model } from "./Model.js";
import { Puppet } from "./Puppet.js";
import { Color } from "../math/Color.js";
import { Vector } from "../math/Vector.js";
import { EditableImage } from "../load/EditableImage.js";
import { typeString } from "../utils/logging.js";
import { Loadable } from "../load/Loadable.js";

export class ModelType extends Model {
    static #SRC = {
        body: "/body.png",
        barrel: "/barrel.png",
        props: "/properties.json"
    };
    static generateSources (root) {
        return {
            body: new EditableImage(root + ModelType.#SRC.body),
            barrel: new EditableImage(root + ModelType.#SRC.barrel),
            props: new ModelProperties(root + ModelType.#SRC.props)
        };
    }
    #loadPromise = Promise.withResolvers();
    #source;
    #ready = false;
    constructor (type, src, colorKey = {}, colorTolerance = 30) {
        const { body, barrel, props } = ModelType.generateSources(src);
        super(type, body, barrel);
        const parent = super.source;
        this.#source = {
            get data () { return parent },
            get props () { return props }
        }
        Promise.all([super.onload, props.onload])
            .then(() => {
                for (const [ target, dest ] of Object.entries(colorKey)) {
                    const oldColor = new Color(target);
                    const newColor = new Color(dest);
                    swapImageColors(body, oldColor, newColor, colorTolerance);
                    swapImageColors(barrel, oldColor, newColor, colorTolerance);
                }
                this.#ready = true;
                this.#loadPromise.resolve(this);
            })
            .catch((err) => this.#loadPromise.reject(err));
    }

    Model () { return new Model(this.type, this.body, this.barrel) }
    Puppet () {
        const puppet = new Puppet(this.body, this.barrel);
    }

    get isModelType () { return true }
    get ready () { return this.#ready }
    get onload () { return this.#loadPromise.promise }
    get source () { return this.#source }
    get props () { return this.#source.props }
    get body () { return this.#source.data.body }
    get barrel () { return this.#source.data.barrel }
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

class ModelProperties extends Loadable {
    #loadPromise = Promise.withResolvers();
    #ready = false;
    #source;
    constructor (src) {
        super();
        this.#load(src)
            .then((props) => {
                this.#source = props;
                this.#ready = true;
                this.#loadPromise.resolve(this);
            })
            .catch((err) => this.#loadPromise.reject(err));
    }

    async #load (source) {
        const response = await fetch(source);
        if (!response.ok)
            throw new Error(`[${typeString(this)}]: Failed to fetch model properties`);
        try {
            const props = await response.json();
            props.body.origin = Vector.fromObject(props.body.origin);
            props.body.offset = Vector.fromObject(props.body.offset);
            props.barrel.origin = Vector.fromObject(props.barrel.origin);
            props.barrel.offset = Vector.fromObject(props.barrel.offset);
            return props;
        } catch (err) {
            err.message = `[${typeString(this)}]: Failed to parse model properties\n` + err.message;
            throw err;
        }
    }

    get isModelProperties () { return true }
    get ready () { return this.#ready }
    get onload () { return this.#loadPromise.promise }
    get source () { return this.#source }
    get body () { return this.source.body }
    get barrel () { return this.source.barrel }
}