import { Identifiable } from "../../utils/tracking/Identifiable.js";

export class LoadPool extends Identifiable {
    #pool = {};
    #promisePool;
    #loadPromise;
    #ready = false;
    #size = 0;
    #readySize = 0;

    constructor () {
        super();
        this.#regeneratePromise();
    }

    // [!] replaces old onload without transfering Promise chains
    #regeneratePromise () {
        this.#ready = false;
        this.#loadPromise = Promise.withResolvers();
        const { resolve } = this.#loadPromise;
        Promise.all(
            Array.from(
                Object.values(this.#pool),
                ({promise}) => promise
            )).then(() => {
                resolve(this);
                this.#ready = true;
            });
    }
    #newEntry (key, promise) {
        if (this.has(key)) console.warn(`[${this.constructor.name}]: Overwriting ${this.ready(key) ? "loaded" : "loading"} entry ${key}`);
        const entry = { promise: undefined, value: undefined, ready: false };
        entry.promise = promise.then((value) => {
            entry.value = value;
            this.#readySize++;
            entry.ready = true; // set a flag to filter for pending promises later
            return value;
        });
        this.#size++;
        this.#pool[key] = entry;
    }

    // supports adding multiple key-value pairs at once to avoid redundantly regenerating onload Promise during batch operations
    add (key, promise, ...kwargs) {
        if (kwargs?.length) {
            for (let i = 0; i < kwargs.length; i+=2)
                this.#newEntry(kwargs[i], kwargs[i+1]);
        }
        this.#newEntry(key, promise);
        this.#regeneratePromise();
        return this; // for chaining
    }
    has (key) { return key in this.#pool }
    ready (key) { return this.#pool[key]?.ready }
    get (key) {
        if (this.has(key) && !this.ready(key))
            console.warn(`[${this.constructor.name}]: Accessed entry "${key}" before loading finished`);
        return this.#pool[key]?.value;
    }
    onready (key) { return this.#pool[key]?.promise || Promise.resolve(undefined) }

    get isLoadPool () { return true }
    get allReady () { return this.#ready } // [!] may be redundant?
    get onload () { return this.#loadPromise.promise }
    get size () { return this.#size }
    get readySize () { return this.#readySize }
    get keys () { return Object.keys(this.#pool) }
}