import { isAwaiting, isThenable } from "./utils.js";

// Chainable Transaction that does not expose resolve() and reject()
export class Job {
    #chained;
    #promise;
    #link;
    #fulfilled = false;
    // chained may be any thenable Identifiable
    constructor (chained, promise = undefined) {
        this.#chained = this.#link = chained;
        if (!promise && !chained?.isTransaction)
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
            : new Job(this.#chained, this.#link.then(onFulfilled, onRejected));
    }
    catch (onRejected) { return new Job(this.#chained, this.#link.catch(onRejected)) }
    finally (onFinally) { return new Job(this.#chained, this.#link.finally(onFinally)) }
    eq (other) { // evaulates to true if parent Transactions are the same. This method will recursively climb the Job chain until it reaches the top, regardless of depth
        const id = other?.isWorkerJob ? other.#chained.id : other?.id;
        return this.id === id; 
    }

    get isJob () { return true }
    get id () { return this.#chained.id }
    get fulfilled () { return this.#chained.fulfilled && (!this.#promise || this.#fulfilled) }
}
