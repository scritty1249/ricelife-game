import { TrackableObject, uuid } from "../utils/utils.js";
import { CACHE_TYPES } from "./types.js";

const cacheTypes = Object.keys(CACHE_TYPES);
Object.freeze(cacheTypes);
export class WorkerPool extends TrackableObject {
    #cache = {};  // storing persistant values from workers
    #transaction = {}; // partially automatic garbage collection on resolved transactions
    #workers = [];
    #queue = [];  // FIFO
    #transactionProxy;
    #cacheProxy;
    #src;
    #initPromise = Promise.resolve();
    #CACHE_TYPES = cacheTypes;
    constructor (src, defaultPoolSize = 4) {
        super();
        this.#src = new URL(src);
        // setup workers
        const createWorkerPromises = [];
        for (let i = 0; i < (window.navigator.hardwareConcurrency || defaultPoolSize); i++) createWorkerPromises.push(this.createWorker(i));
        this.#initPromise = Promise.all(createWorkerPromises)
            .finally(() => console.info(`[${this.constructor.name}] Info: ${this.size} workers initalized`));

        // setup proxies
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
                if (prop in target)
                    return false; // reject, transaction already exists
                return Reflect.set(target, prop, value, receiver);
            },
            deleteProperty(target, prop) {
                if (!Reflect.deleteProperty(target, prop))
                    console.warn(`[${this.constructor.name}]: Attempted to delete a transaction that doesn't exist `, prop);
                return true;
            }
        });
    }
    #getWorker () {
        const workerEntry = this.#queue.length > 0
            ? this.#queue.shift()
            : this.#workers.reduce((bestWorker, currentWorker) => {
                    return currentWorker.jobs.size < bestWorker.jobs.size ? currentWorker : bestWorker;
                }, this.#workers[0]);
        if (!workerEntry) throw new Error(`[${this.constructor.name}]: Failed to retrieve Worker (${this.idleCount} idle, ${this.size} total)`);
        return workerEntry;
    }
    #postJob (type, payload, transfer = [], command = "", worker = undefined, dispose = false) {
        const transaction = new WorkerTransaction();
        const { id } = transaction;
        this.#transaction[id] = transaction;
        const w = worker || this.#getWorker();
        w.instance.postMessage({type, payload, id, command}, transfer);
        w.jobs.add(id);
        console.debug(`[${this.constructor.name}]: Transaction ${id} posted to Worker ${w.id}\n\t${command ? command : type}: `,  payload);
        return dispose
        // always return a Job, not Transaction
            ? transaction.finally(() => {
                delete this.transaction[transaction.id];
            })
            : new WorkerJob(transaction);
    }
    #cacheAt (id) { // return worker entry that holds the cache of given id
        for (const entry of this.#workers)
            if (entry.cache.has(id)) return entry;
        return undefined;
    }
    #workerAt (id) {
        for (const entry of this.#workers)
            if (entry.id === id) return entry;
        return undefined;
    }
    #isWorkerFree (worker) {
        for (const { id } of this.#queue)
            if (id === worker.id) return true;
        return false;
    }
    #getPrioritizedWorker (cachesUsed = []) {
        for (let i = 0; i < this.#queue.length; i++) {
            const worker = this.#queue[i];
            if (cachesUsed.some((cache) => worker.cache.has(cache))) {
                this.#queue.splice(i, 1);
                return worker;
            }
        }            
        return this.#getWorker();
    }
    async #dropCache (id, worker) {
        return await this.#postJob(
            "", 
            { cache: id }, 
            [], 
            "DROPCACHE",
            worker,
            true
        );
    }
    async #initWorker (entry) {
        const { id, instance: worker } = entry;
        return await new Promise((resolve, reject) => {
            worker.onerror = (event) => {
                const msg = `[${this.constructor.name}]: Worker ${id} crashed at initialization\n\tMessage: ${event?.message}\n\tFile: ${event?.filename}\n\tLine: ${event?.lineno}`;
                console.error(msg);
                reject(new Error(msg));
            };
            worker.onmessage = (event) => {
                if (event.data?.type === "READY") {                    
                    worker.onerror = WorkerPool.#workerErrorHandler.bind(this, entry);
                    worker.onmessage = WorkerPool.#workerMessageHandler.bind(this, entry);
                    worker.onmessageerror = WorkerPool.#workerMessageErrorHandler.bind(this, entry);
                    // setup MessageChannels
                    for (const peer of this.#workers) {
                        const channel = new MessageChannel();
                        this.#postJob("", {
                            port: channel.port1,
                            worker: peer.id
                        }, [channel.port1], "ADDWKR", entry, true);
                        this.#postJob("", {
                            port: channel.port2,
                            worker: id
                        }, [channel.port2], "ADDWKR", peer, true);
                    }
                    // add to record
                    this.#workers.push(entry);
                    this.#queue.push(entry);
                    resolve();
                } else {
                    console.debug(`[${this.constructor.name}]: Unknown message on initalization from worker ${id}\n`, event);
                }
            };
        });
    }
    cacheAt (cache) { // return id of worker that holds cache of given id
        return this.#cacheAt(cache)?.id;
    }
    createWorker () {
        // init
        const id = uuid();
        const src = new URL(this.#src);
        src.searchParams.append("id", id);
        const worker = new Worker(src, { type: "module" });
        if (!worker) throw new Error(`[${this.constructor.name}]: Failed to initialize worker ${id}`);
        const entry = {
            id,
            instance: worker,
            jobs: new Set(),
            cache: new Set() // keep a record of what cache ids this worker owns, pool manager needs to make sure this mirrors worker state while avoiding polling/querying
        };
        return this.#initWorker(entry);
    }
    async post (type, payload, transfer = [], cachesUsed = []) {
        const worker = this.#getPrioritizedWorker(cachesUsed);
        const ownedCaches = worker.cache.intersection(new Set(cachesUsed)).size;
        const transfers = [];
        for (const peer of this.#workers) {
            if (peer.id === worker.id) continue;
            for (const cache of cachesUsed)
                if (peer.cache.has(cache))
                    transfers.push(this.copyCache(cache, peer.id, worker.id, true));
        }
        if (transfers.length !== cachesUsed.length - ownedCaches) {
            throw new Error(`[${this.constructor.name}]: Failed to gather cache(s) specified for worker job`);
        }
        await Promise.all(transfers)
            .catch(() => { throw new Error(`[${this.constructor.name}]: Failed to transfer cache(s) specified for worker job`)});
        return this.#postJob(type, payload, transfer, "", worker) // don't dispose of transaction
            .then(({payload}) => payload);
    }
    terminate () {
        for (const { instance } of this.#workers) instance.terminate();
        this.#workers.splice(0, this.#workers.length);
        this.#queue.splice(0, this.#queue.length);
    }
    async initCache (type, args = [], id = uuid()) {
        if (!(type in CACHE_TYPES)) throw new Error(`[${this.constructor.name}]: ${type} is not a valid cache type`);
        const worker = this.#getWorker();
        return this.#postJob(
            "", 
            { cache: id, type, args }, 
            [], 
            "INITCACHE",
            worker,
            true
        ).then(() => {
            worker.cache.add(id);
        });
    }
    async pushCache (type, payload, id = undefined) {
        const defaultedId = (id === undefined);
        const staleCacheWorker = defaultedId ? undefined : this.#cacheAt(id);
        const cache = defaultedId ? uuid() : id;
        const worker = this.#getWorker();
        let concurrent = Promise.resolve();

        if (staleCacheWorker && worker.id !== staleCacheWorker.id) {
            // drop cache from old worker, push new cache onto available worker
            staleCacheWorker.cache.delete(cache);
            concurrent = this.#dropCache(cache, staleCacheWorker);
        }
        const result = this.#postJob(
            "", 
            { cache, type, payload }, 
            [], 
            "PUSHCACHE",
            worker,
            true
        );
        return new WorkerJob(result, concurrent)
            .then(() => { worker.cache.add(cache) });
    }
    async dropCache (id) {
        const worker = this.#cacheAt(id);
        if (!worker) return;
        return await this.#dropCache(id, worker)
            .then(() => { worker.cache.delete(id) });
    }
    async copyCache (cache, target, dest, transfer = true) {
        const worker = this.#workerAt(target);
        const receiver = this.#workerAt(dest);
        if (worker === undefined) throw new Error(`[${this.constructor.name}]: Worker ${target} does not exist`);
        if (receiver === undefined) throw new Error(`[${this.constructor.name}]: Worker ${dest} does not exist`);
        return this.#postJob(
            "", 
            { worker: dest, manager: false, transfer, cache }, 
            [],
            "SENDCACHE",
            worker,
            true
        ).then(() => {
            if (transfer) worker.cache.delete(cache);
            receiver.cache.add(cache);
        });
    }
    async pullCache (cache, transfer = true, transferReference = false) {
        const worker = this.#cacheAt(cache);
        if (worker === undefined) return null; // signal something went wrong
        const { type, payload } = await this.#postJob(
            "", 
            { manager: true, reference: !transferReference, transfer, cache }, 
            [],
            "SENDCACHE",
            worker,
            true
        );
        if (transfer && transferReference) worker.cache.delete(cache);
        if (type in CACHE_TYPES) {
            this.cache[cache] = CACHE_TYPES[type].encode(payload);
            return this.cache[cache];
        } else {
            // callers responsiblity to deal with the mess
            throw new Error(`[${this.constructor.name}]: Worker ${worker.id} returned a cache of unknown type ${type}`);
        }
    }

    get isWorkerPool () { return true }
    get size () { return this.#workers.length }
    get idleCount () { return this.#queue.length }
    get transaction () { return this.#transactionProxy }
    get cache () { return this.#cacheProxy }
    get CACHE_TYPES () { return this.#CACHE_TYPES }
    get initPromise () { return this.#initPromise }

    static #workerMessageHandler (entry, event) {
        const { id, error } = event.data;
        if (id in this.#transaction) {
            if (entry.jobs.has(id)) entry.jobs.delete(id); // update running job queue
            else console.warn(`[${this.constructor.name}] Warning: Web worker ${entry.id} replied to an unregistered job\n`, event?.data);
            if (!this.#queue.includes(entry)) this.#queue.push(entry); // push onto top of queue if it doesnt already exist there
            if (error) this.#transaction[id].reject(event.data);
            else this.#transaction[id].resolve(event.data);
        } else if (error) {
            console.error(`[${this.constructor.name}]: Wrker ${entry.id} caught an Error\n`, event?.data);
        } else {
            console.warn(`[${this.constructor.name}]: Worker ${entry.id} replied to an unregistered transaction\n`, event?.data);
        }
    }
    static #workerMessageErrorHandler (entry, event) {
        console.error(`[${this.constructor.name}]: Worker ${entry.id} failed to serialize message\n`, event?.data);
    }
    static #workerErrorHandler (entry, event) {
        throw new Error(`[${this.constructor.name}]: Worker ${entry.id} threw uncaught Error\n\tMessage: ${event?.message}\n\tFile: ${event?.filename}\n\tLine: ${event?.lineno}`);
    }
}

class WorkerTransaction extends TrackableObject {
    #promise;
    #resolve;
    #reject;
    #fulfilled = false;
    constructor () {
        super();
        const { promise, resolve, reject } = Promise.withResolvers();
        this.#promise = promise;
        this.#resolve = (value) => {
            this.#fulfilled = true;
            resolve(value);
        };
        this.#reject = (reason) => {
            this.#fulfilled = true;
            reject(reason);
        };
    }

    then (onFulfilled, onRejected = undefined) {
        return isAwaiting(onFulfilled)
            ? this.#promise.then(onFulfilled, onRejected) // support for await
            : new WorkerJob(this, this.#promise.then(onFulfilled, onRejected));
    }
    catch (onRejected) { return new WorkerJob(this, this.#promise.catch(onRejected)) }
    finally (onFinally) { return new WorkerJob(this, this.#promise.finally(onFinally)) }

    get isWorkerTransaction () { return true }
    get fulfilled () { return this.#fulfilled }
    get resolve () { return this.#resolve }
    get reject () { return this.#reject }
    get id () { return super.id }
}

class WorkerJob { // Chainable transaction that does not expose resolve() and reject()
    #chained;
    #promise;
    #link;
    #fulfilled = false;
    // chained may be any thenable TrackableObject
    constructor (chained, promise = undefined) {
        this.#chained = this.#link = chained;
        if (!promise && !chained?.isWorkerTransaction)
            throw new Error(`[${this.constructor.name}] Error: Cannot initalize with non-Transaction parameter ${typeof chained}`);
        else if (promise) {
            if (!isThenable(chained))
                throw new Error(`[${this.constructor.name}] Error: Cannot initalize chained from non-Thenable parameter ${typeof chained}`);
            if (!isThenable(promise))
                throw new Error(`[${this.constructor.name}] Error: Cannot initalize with non-Thenable parameter ${typeof promise}`);
            this.#promise = this.#link = promise;
            // Lags- only evals to true on next microtask
            // See https://developer.mozilla.org/en-US/docs/Web/API/HTML_DOM_API/Microtask_guide and https://developer.mozilla.org/en-US/docs/Web/API/HTML_DOM_API/Microtask_guide/In_depth
            this.#promise.finally(() => { this.#fulfilled = true });
        }
    }

    then (onFulfilled, onRejected = undefined) {
        return isAwaiting(onFulfilled)
            ? this.#link.then(onFulfilled, onRejected) // support for await
            : new WorkerJob(this.#chained, this.#link.then(onFulfilled, onRejected));
    }
    catch (onRejected) { return new WorkerJob(this.#chained, this.#link.catch(onRejected)) }
    finally (onFinally) { return new WorkerJob(this.#chained, this.#link.finally(onFinally)) }
    eq (other) { // evaulates to true if parent Transactions are the same. This method will recursively climb the Job chain until it reaches the top, regardless of depth
        const id = other?.isWorkerJob ? other.#chained.id : other?.id;
        return this.id === id; 
    }

    get isWorkerJob () { return true }
    get id () { return this.#chained.id }
    get fulfilled () { return this.#chained.fulfilled && (!this.#promise || this.#fulfilled) }
}

function isThenable (obj) {
    return (obj
        && typeof obj?.then === "function"
        && typeof obj?.catch === "function"
        && typeof obj?.finally === "function"
    );
}
function isAwaiting (onFulfilled) {
    return typeof onFulfilled === "function"
        && !onFulfilled.name
        && onFulfilled.toString().includes("[native code]");
}