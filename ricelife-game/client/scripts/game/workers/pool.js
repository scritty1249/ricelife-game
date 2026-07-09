import { TrackableObject, uuid } from "../utils/utils.js";
import { CACHE_TYPES } from "./types.js";

const cacheTypes = Object.keys(CACHE_TYPES);
Object.freeze(cacheTypes);
export class WorkerPool extends TrackableObject {
    static OPTIMAL_THREAD_COUNT = 4;
    #cache = {};  // storing persistant values from workers
    #transaction = {}; // partially automatic garbage collection on resolved transactions
    #workers = [];
    #queue = [];  // FIFO
    #transactionProxy;
    #cacheProxy;
    #src;
    #loadPromise = Promise.resolve();
    #CACHE_TYPES = cacheTypes;
    #LOG_LEVEL; // 1 - Transaction post messages | 2 - Transaction received messages | 3 - Transaction state change messages | 4 - Transaction completed messages 
    constructor (src, defaultPoolSize = WorkerPool.OPTIMAL_THREAD_COUNT, logLevel = 4) {
        super();
        this.#src = new URL(src);
        this.#LOG_LEVEL = logLevel;
        // setup workers
        const createWorkerPromises = [];
        const targetSize = (window.navigator.hardwareConcurrency || defaultPoolSize);
        for (let i = 0; i < targetSize; i++) createWorkerPromises.push(this.createWorker(i));
        this.#loadPromise = Promise.all(createWorkerPromises)
            .finally(() => {
                if (this.size >= targetSize)
                    console.info(`[${this.constructor.name}]: ${this.size} workers initalized`);
                else
                    console.error(`[${this.constructor.name}]: Failed to initalize ${targetSize - this.size} workers. ${this.size} workers initalized`);
                if (this.size < this.constructor.OPTIMAL_THREAD_COUNT)
                    console.warn(`[${this.constructor.name}]: Worker pool size (${this.size}) is lower than the minimum (${this.constructor.OPTIMAL_THREAD_COUNT}). Performance may be impacted`);
            });

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
        const w = worker || this.#getWorker();
        const transaction = new WorkerTransaction(w.id);
        const { id } = transaction;
        transaction.data.called = command ? command : type;
        this.#transaction[id] = transaction;
        w.jobs.add(id);
        w.instance.postMessage({type, payload, id, command}, transfer);
        if (this.#LOG_LEVEL >= 1) console.debug(`[${this.constructor.name}]: Transaction ${id} posted to Worker ${w.id}\n\t${command ? command : type}: `,  payload);
        if (dispose) transaction.finally(() => delete this.transaction[transaction.id] );
        // always return a Job, not Transaction
        return new WorkerJob(transaction);
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
    #getPrioritizedWorker (cachesUsed = new Set()) {
        const caches = Array.from(cachesUsed);
        for (let i = 0; i < this.#queue.length; i++) {
            const worker = this.#queue[i];
            if (caches.some((cache) => worker.cache.has(cache))) {
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
        // initalize worker
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
        const entry = new WorkerEntry(this.#src, {logLevel: this.#LOG_LEVEL});
        if (Number.isFinite(window.navigator.hardwareConcurrency) && this.size + 1 > window.navigator.hardwareConcurrency)
            console.warn(`[${this.constructor.name}]: Worker pool size exceeds supported hardware concurrency. Performance may be impacted`);
        return this.#initWorker(entry);
    }
    getTransactionWorker (transactionid) {
        return this.#transaction[transactionid]?.worker;
    }
    async post (type, payload, transfer = [], cachesUsed = []) {
        const caches = new Set(cachesUsed);
        const worker = this.#getPrioritizedWorker(caches);
        const unownedCaches = caches.difference(worker.cache);
        const transfers = [];
        for (const cache of unownedCaches) transfers.push(this.transferCache(cache, worker.id, true, false));
        await Promise.all(transfers)
            .catch((e) => { console.warn(`[${this.constructor.name}]: Failed to transfer cache(s) specified for worker job\n`, e)});
        return await this.#postJob(type, payload, transfer, "", worker) // don't dispose of transaction
            .then(({payload}) => Object.keys(payload).length === 0 ? undefined : payload ); // [!] getting empty objects instead of undefined for some reason on webworker response??
    }
    terminate () {
        for (const { instance } of this.#workers) instance.terminate();
        this.#workers.splice(0, this.#workers.length);
        this.#queue.splice(0, this.#queue.length);
    }
    initCache (type, args = [], id = uuid()) {
        if (!(type in CACHE_TYPES)) throw new Error(`[${this.constructor.name}]: ${type} is not a valid cache type`);
        const worker = this.#getWorker();
        return this.#postJob(
            "", 
            { cache: id, type, args }, 
            [], 
            "INITCACHE",
            worker,
            true
        );
    }
    async hashCache (id) {
        let worker = this.#cacheAt(id);
        if (worker?.isBusy) {
            if (this.#LOG_LEVEL >= 1) console.debug(`[${this.constructor.name}]: Waiting for cache ${id}`);
            await worker.onAvailable;
            worker = this.#cacheAt(cache);
        }
        if (worker === undefined) throw new Error(`[${this.constructor.name}]: Cache ${id} does not exist`);
        return this.#postJob(
            "", 
            { cache: id, manager: true }, 
            [],
            "HASHCACHE",
            worker,
            true
        ).then(({payload}) => payload.hash);
    }
    async pushCache (type, payload, id = undefined) {
        const defaultedId = (id === undefined);
        const staleCacheWorker = defaultedId ? undefined : this.#cacheAt(id);
        const cache = defaultedId ? uuid() : id;
        const worker = this.#getWorker();
        let concurrent = Promise.resolve();

        if (staleCacheWorker && worker.id !== staleCacheWorker.id) {
            // drop cache from old worker, push new cache onto available worker
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
        await Promise.all([concurrent, result]);
    }
    dropCache (id) {
        const worker = this.#cacheAt(id);
        if (!worker) return;
        return this.#dropCache(id, worker);
    }
    async copyCache (cache, dest, transfer = true, preserveKey = true) { // copies one cache to another
        let worker = this.#cacheAt(cache);
        if (worker?.isBusy) {
            if (this.#LOG_LEVEL >= 1) console.debug(`[${this.constructor.name}]: Waiting for cache ${cache}`);
            await worker.onAvailable;
            worker = this.#cacheAt(cache);
        }
        let receiver = this.#cacheAt(dest);
        if (receiver?.isBusy) {
            if (this.#LOG_LEVEL >= 1) console.debug(`[${this.constructor.name}]: Waiting for cache ${dest}`);
            await receiver.onAvailable;
            receiver = this.#cacheAt(dest);
        }
        if (worker === undefined) throw new Error(`[${this.constructor.name}]: Cache ${cache} does not exist`);
        if (receiver === undefined) throw new Error(`[${this.constructor.name}]: Cache ${dest} does not exist`);
        return this.#postJob(
            "", 
            { worker: receiver.id, manager: false, newCache: dest, preserveKey, transfer, cache }, 
            [],
            "SENDCACHE",
            worker,
            true
        );
    }
    async transferCache (cache, dest, copy = true, preserveKey = true) { // copies one cache to a worker
        let worker = this.#cacheAt(cache);
        if (worker?.isBusy) {
            if (this.#LOG_LEVEL >= 1) console.debug(`[${this.constructor.name}]: Waiting for cache ${cache}`);
            await worker.onAvailable;
            worker = this.#cacheAt(cache);
        }
        const receiver = this.#workerAt(dest);
        if (worker === undefined) throw new Error(`[${this.constructor.name}]: Cache ${cache} does not exist`);
        if (receiver === undefined) throw new Error(`[${this.constructor.name}]: Worker ${dest} does not exist`);
        if (worker.id === receiver.id) return;
        return this.#postJob(
            "", 
            { worker: receiver.id, manager: false, transfer: copy, preserveKey, cache }, 
            [],
            "SENDCACHE",
            worker,
            true
        );
    }
    async pullCache (cache, transfer = true, preserveKey = true) {
        let worker = this.#cacheAt(cache);
        if (worker?.isBusy) {
            if (this.#LOG_LEVEL >= 1) console.debug(`[${this.constructor.name}]: Waiting for cache ${cache}`);
            await worker.onAvailable;
            worker = this.#cacheAt(cache);
        }
        if (worker === undefined) return null; // signal something went wrong
        const { type, payload } = await this.#postJob(
            "", 
            { manager: true, preserveKey, transfer, cache }, 
            [],
            "SENDCACHE",
            worker,
            true
        );
        if (type in CACHE_TYPES) {
            this.cache[cache] = CACHE_TYPES[type].encode(payload, false);
        } else {
            // callers responsiblity to deal with the mess
            throw new Error(`[${this.constructor.name}]: Worker ${worker.id} returned a cache of unknown type ${type}`);
        }
        return true;
    }

    get isWorkerPool () { return true }
    get size () { return this.#workers.length }
    get idleCount () { return this.#queue.length }
    get transaction () { return this.#transactionProxy }
    get cache () { return this.#cacheProxy }
    get CACHE_TYPES () { return this.#CACHE_TYPES }
    get onload () { return this.#loadPromise }

    static #workerMessageHandler (entry, event) {
        const { id, error, state } = event.data;
        const completedMessage = [`[${this.constructor.name}]: Worker ${entry.id} completed Transaction ${id}`]
        const subId = /^CACHEUPDATE_([a-z0-9]+\-[a-z0-9]+\-[a-z0-9]+\-[a-z0-9]+\-[a-z0-9]+)_[0-9]+$/g.exec(id)?.[1];
        if (this.#LOG_LEVEL >= 4) completedMessage.push(` \n\tState: `, state);
        if (state && "cache" in state) {
            const added = new Set(state.cache).difference(entry.cache);
            const removed = entry.cache.difference(new Set(state.cache));
            if (this.#LOG_LEVEL >= 3 && (added.size || removed.size)) {
                completedMessage.push("\n\tCache change: ");
                if (added.size) completedMessage.push("Added", added);
                if (removed.size) completedMessage.push("Removed", removed);
                console.debug(...completedMessage);
            }
            entry.cache.clear();
            for (const cache of state.cache) {
                const peer = this.cacheAt(cache);
                if (!subId && peer) console.warn(`[${this.constructor.name}]: Worker cache key collision ${cache}\n\tTransaction: ${id}\n\tColliding Worker: ${entry.id}\n\tVictim Worker: ${peer}`);
                entry.cache.add(cache);
            }
        }
        if (subId && subId in this.#transaction) {
            completedMessage.push("\n\tCalled:", this.#transaction[subId].data?.called);
            if (this.#LOG_LEVEL >= 4) console.debug(...completedMessage);
        } else if (id in this.#transaction) {
            completedMessage.push("\n\tCalled:", this.#transaction[id].data?.called);
            if (entry.jobs.has(id)) entry.jobs.delete(id); // update running job queue
            else console.warn(`[${this.constructor.name}] Warning: Web worker ${entry.id} replied to an unregistered job\n`, event?.data);
            if (!this.#queue.includes(entry)) this.#queue.push(entry); // push onto top of queue if it doesnt already exist there
            if (!entry.isBusy) entry.setAvailable(); // trigger anything waiting
            if (error) this.#transaction[id].reject(event.data);
            else {
                this.#transaction[id].resolve(event.data);
                if (this.#LOG_LEVEL >= 4) console.debug(...completedMessage);
            }
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

class WorkerEntry extends TrackableObject {
    #state = {
        promise: undefined,
        resolve: undefined,
        reject: undefined,
        isResolved: false
    };
    #instance;
    #cache = new Set(); // keep a record of what cache ids this worker owns, pool manager needs to make sure this mirrors worker state while avoiding polling/querying
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

    get instance () { return this.#instance }
    get cache () { return this.#cache }
    get jobs () { return this.#jobs }
    get isBusy () { return this.#jobs.size !== 0 }
    get onAvailable () { return this.#state.promise } // this is only accurate is worker is busy. Callers should always check isBusy === true before awaiting this property
}

class WorkerTransaction extends TrackableObject {
    #promise;
    #resolve;
    #reject;
    #workerid;
    #fulfilled = false;
    data = {}; // [!] use for holding debug info or tracking payload
    constructor (workerid) {
        super();
        const { promise, resolve, reject } = Promise.withResolvers();
        this.#workerid = workerid;
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
    get worker () { return this.#workerid }
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