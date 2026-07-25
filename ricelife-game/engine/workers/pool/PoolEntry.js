import { TrackableObject } from "/engine/core/utils/tracking/TrackableObject.js";

export class PoolEntry extends TrackableObject {
    #instance;
    #state = {
        promise: undefined,
        resolve: undefined,
        reject: undefined,
        isResolved: false
    };
    // keep a record of what cache ids this worker owns
    //  pool manager needs to make sure this mirrors worker state while avoiding polling/querying
    #cache = new Set();
    #jobs = new Set();
    constructor (workerSrc, workerParams = {}) {
        super();
        const src = new URL(workerSrc);
        src.searchParams.append("id", this.id);
        for (const [key, value] of Object.entries(workerParams)) src.searchParams.append(key, value);
        const worker = new Worker(src, { type: "module" });
        if (!worker) throw new Error(`[${this.constructor.name}]: Failed to initialize web worker instance`);
        this.#instance = worker;
        this.#regeneratePromise();
        this.setAvailable();
    }

    #regeneratePromise () {
        const state = this.#state;
        const oldResolve = state.resolve;
        const maintainOldPromise = oldResolve !== undefined && !state.isResolved;
        ({promise: state.promise, resolve: state.resolve, reject: state.reject} = Promise.withResolvers());
        state.isResolved = false;
        if (maintainOldPromise) state.promise.then(() => oldResolve());
    }

    setAvailable () {
        this.#state.isResolved = true;
        this.#state.resolve();
        this.#regeneratePromise();
    }

    get isPoolEntry () { return true }
    get instance () { return this.#instance }
    get cache () { return this.#cache }
    get jobs () { return this.#jobs }
    get isBusy () { return this.#jobs.size !== 0 }
    get onAvailable () { return this.#state.promise } // this is only accurate is worker is busy. Callers should always check isBusy === true before awaiting this property
}