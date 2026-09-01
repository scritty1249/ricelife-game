import { Identifiable } from "../../utils/tracking/Identifiable.js";

// everything here is in milliseconds
export class Interval {
    #interval;
    #lastInterval = performance.now();
    #lastDelta = performance.now();
    constructor (interval) { this.#interval = interval }

    #delta (time) { return time - this.#lastInterval }

    freeze () { this.#lastInterval = performance.now() - this.interval }

    get interval () { return this.#interval }
    get delta () { return performance.now() - this.#lastInterval }
    get lastDelta () { return this.#lastDelta } // delta value just before ready was called
    // check and set
    get ready () {
        const now = performance.now();
        const delta = this.#delta(now);
        if (delta >= this.#interval) { // access directly for speed
            this.#lastInterval = now;
            this.#lastDelta = delta;
            return true;
        }
        return false;
    }
}
