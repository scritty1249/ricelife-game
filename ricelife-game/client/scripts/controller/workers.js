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
    exists (id) { return (id in this.#transaction) }
    async post (type, payload, transfer = [], key = undefined, cache = []) { // cache here is a list of keys from the return payload to store at the specified key. If nothing is cached the transaction will be deleted immedately after resolving
        const transaction = new WorkerTransaction();
        const { id } = transaction;
        this.#transaction[id] = transaction;
        this.#worker.postMessage({type, payload, id}, transfer);
        transaction.then((data) => {
            if (key && cache.length) {
                const buf = {};
                for (const k of cache)
                    buf[k] = data[k];
                this.cache[key] = buf;
            } else
                delete this.transaction[id]; // [!] may be unsafe to free memory and then return that same value... need to decide on exact use case here
            return data;
        });
        return new WorkerJob(transaction);
    }
    get isWorkerManager () { return true }
    get transaction () { return this.#transactionProxy }
    get cache () { return this.#cacheProxy }
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

    then (onFulfilled, onRejected = undefined) { return this.#promise.then(onFulfilled, onRejected) }
    catch (onRejected) { return this.#promise.catch(onRejected) }
    finally (onFinally) { return this.#promise.finally(onFinally) }

    get isWorkerTransaction () { return true }
    get fulfilled () { return this.#fulfilled }
    get resolve () { return this.#resolve }
    get reject () { return this.#reject }
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

    then (onFulfilled, onRejected = undefined) { return new WorkerJob(this.#chained, this.#link.then(onFulfilled, onRejected)) }
    catch (onRejected) { return new WorkerJob(this.#chained, this.#link.catch(onRejected)) }
    finally (onFinally) { return new WorkerJob(this.#chained, this.#link.finally(onFinally)) }
    eq (other) { return this.#chained.eq(other) } // evaulates to true if parent Transactions are the same. This method will recursively climb the Job chain until it reaches the top, regardless of depth

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