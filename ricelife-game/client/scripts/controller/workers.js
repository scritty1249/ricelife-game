import { TrackableObject, uuid } from "../utils/utils.js";

export class WorkerManager extends TrackableObject {
    #cache;
    #worker;
    #transaction;
    #transactionProxy;
    #cacheProxy;
    constructor (src) {
        super();
        this.#cache = {}; // storing persistant values from worker
        this.#worker = new Worker(src, {type: "module"}); // path is relative to wherever this is being imported from browser POV- i.e. from index.html
        if (!this.#worker) throw new Error(`[${this.constructor.name}] Error: Failed to initalize web worker - file could not be loaded`);
        this.#transaction = {}; // partially automatic garbage collection on resolved transactions
        this.#worker.onmessage = (e) => {
            const { id, error } = e.data;
            if (this.#transaction[id]) {
                this.#transaction[id].isResolved = true;
                if (error) this.#transaction[id].reject(e.data);
                else this.#transaction[id].resolve(e.data);
            } else {
                console.warn(`[${this.constructor.name}] Warning: Web worker replied to an unregistered transaction `, e);
            }
        }
        this.#worker.onerror = (err) => {
            console.error(`[${this.constructor.name}] Error: Worker crashed - ${err?.messaage}`);
            throw err
        }
        this.#cacheProxy = new Proxy(this.#cache, {
            set(target, prop, value, receiver) {
                if (target[prop])
                    for (const data of Object.values(target[prop]))
                        if (typeof data?.close === "function") data.close(); // cleanup memory
                return Reflect.set(target, prop, value, receiver);
            },
            deleteProperty(target, prop) {
                if (target[prop])
                    for (const data of Object.values(target[prop]))
                        if (typeof data?.close === "function") data.close(); // cleanup memory
                return Reflect.deleteProperty(target, prop);
            }
        });
        this.#transactionProxy = new Proxy(this.#transaction, {
            set(target, prop, value, receiver) {
                if (property in target)
                    return false; // reject, transaction already exists
                return Reflect.set(target, prop, value, receiver);
            },
            deleteProperty(target, prop) {
                return Reflect.deleteProperty(target, prop);
            }
        });
    }

    async post (type, payload, transfer = [], key = undefined, cache = []) { // cache here is a list of keys from the return payload to store at the specified key. If nothing is cached the transaction will be deleted immedately after resolving
        const transaction = Transaction();
        const id = transaction.id;
        this.#transaction[id] = transaction;
        this.#worker.postMessage({type, payload, id}, transfer);
        return transaction.promise
            .then((data) => {
                if (key && cache.length) {
                    const buf = {};
                    for (const k of cache)
                        buf[k] = data[k];
                    this.cache[key] = buf;
                } else
                    delete this.transaction[id]; // [!] may be unsafe to free memory and then return that same value... need to decide on exact use case here
                return data;
            });
    }
    get transaction () { return this.#transactionProxy }
    get cache () { return this.#cacheProxy }
}

function Transaction () {
    const id = uuid();
    return {
        id: id,
        isResolved: false,
        ...Promise.withResolvers()
    };
}
