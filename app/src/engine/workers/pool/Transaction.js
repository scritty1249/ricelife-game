import { Identifiable } from "../../core/utils/tracking/Identifiable.js";
import { isAwaiting } from "./utils.js";
import { Job } from "./Job.js";

export class Transaction extends Identifiable {
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
            : new Job(this, this.#promise.then(onFulfilled, onRejected));
    }
    catch (onRejected) { return new Job(this, this.#promise.catch(onRejected)) }
    finally (onFinally) { return new Job(this, this.#promise.finally(onFinally)) }

    get isTransaction () { return true }
    get fulfilled () { return this.#fulfilled }
    get resolve () { return this.#resolve }
    get reject () { return this.#reject }
    get worker () { return this.#workerid }
    get id () { return super.id }
}
