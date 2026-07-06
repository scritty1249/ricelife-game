import { TrackableObject } from "../utils/utils.js";

export class LoadPool extends TrackableObject {
    #pool = {};
    #promisePool;
    #loadPromise;
    #ready = false;
    #size = 0;
    #readySize = 0;

    constructor () {
        super();
    }

    // [!] replaces old onload without transfering Promise chains
    #regeneratePromise () {
        this.#ready = false;
        this.#loadPromise = Promise.withResolvers();
        Promise.all(Object.values(this.#pool)
            .filter(({ready}) => !ready)
            .map(({value}) => value))
            .then(() => {
                this.#loadPromise.resolve(this);
                this.#ready = true;
            });
    }
    #newEntry (key, promise) {
        if (this.has(key)) console.warn(`[${this.constructor.name}]: Overwriting ${this.ready(key) ? "loaded" : "loading"} entry ${key}`);
        const entry = { promise, value: undefined, ready: false };
        entry.promise.then((value) => {
            entry.value = value;
            this.#readySize++;
            entry.ready = true; // set a flag to filter for pending promises later
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
    get (key) { return this.#pool[key]?.value }
    onready (key) { return this.#pool[key]?.promise || Promise.resolve(undefined) }

    get isLoadPool () { return true }
    get allReady () { return this.#ready } // [!] may be redundant?
    get onload () { return this.#loadPromise.promise }
    get size () { return this.#size }
    get readySize () { return this.#readySize }
    get keys () { return Object.keys(this.#pool) }
}

export class AmmoPool extends LoadPool { 
    #importPath;
    constructor (importPath, ...ammoTypes) {
        super();
        this.#importPath = importPath;
        if (ammoTypes?.length) this.add(...ammoTypes);
    }

    #path (ammoType) { return `${this.importPath}/${ammoType.toLowerCase()}.js` }

    add (...ammoTypes) {
        if (!ammoTypes?.length) return;
        const entries = [];
        for (const ammoType of ammoTypes)
            entries.push(
                ammoType,
                import(this.#path(ammoType))
                    .then(({default: value}) => value)
            )
        super.add(...entries);
        return this; // for chaining
    }

    get isAmmoPool () { return true }
    get importPath () { return this.#importPath }
}