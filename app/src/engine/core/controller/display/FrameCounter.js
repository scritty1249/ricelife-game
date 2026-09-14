export class FrameCounter {
    #historyLength;
    #history = new Array();
    #lastUpdateAt = performance.now();
    #fps = 0;
    constructor (historyLength = 10) {
        this.length = historyLength;
    }

    update () {
        const history = this.#history;
        const now = performance.now();
        const delta = (now - this.lastUpdateAt) / 1000;
        this.#lastUpdateAt = now;
        history.push(1 / delta);
        if (history.length > this.length) history.shift();
        this.#fps = Math.round(history.reduce((a, b) => a + b) / this.length);
    }

    get lastUpdateAt () { return this.#lastUpdateAt }
    get fps () { return this.#fps }
    get length () { return this.#historyLength }
    set length (number) { return (this.#historyLength = number) }
}
