import { Vector } from "../../math/Vector.js";
import { Loadable } from "../../load/Loadable.js";
import { typeString } from "../../utils/logging.js";

export class ModelInfo extends Loadable {
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

    get isModelInfo () { return true }
    get ready () { return this.#ready }
    get onload () { return this.#loadPromise.promise }
    get source () { return this.#source }
    get body () { return this.source.body }
    get barrel () { return this.source.barrel }
}
