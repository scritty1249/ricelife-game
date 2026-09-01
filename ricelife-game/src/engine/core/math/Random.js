import { BIT32_SPACE } from "./Hash.js";

export class Random {
    static #generateSeedPart () { return (Math.random()*2**32)>>>0 }
    static seed () {
        return [
            Random.#generateSeedPart(),
            Random.#generateSeedPart(),
            Random.#generateSeedPart(),
            Random.#generateSeedPart()
        ]
    }
    // cyrb128
    static seedString (str) {
        let k, h1 = 1779033703, h2 = 3024734485, h3 = 3362625948, h4 = 502494325;
        for (let i = 0; i < str.length; i++) {
            k = str.charCodeAt(i);
            h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
            h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
            h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
            h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
        }
        return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
    }
    #seedA;
    #seedB;
    #seedC;
    #seedD;
    #a;
    #b;
    #c;
    #d;
    constructor (seed = Random.seed()) {
        [this.#seedA, this.#seedB, this.#seedC, this.#seedD]
        = [this.#a, this.#b, this.#c, this.#d]
        = seed;
    }

    // sfc32
    random () {
        this.#a |= 0;
        this.#b |= 0;
        this.#c |= 0;
        this.#d |= 0;
        let t = (this.#a + this.#b | 0) + this.#d | 0;
        this.#d = this.#d + 1 | 0;
        this.#a = this.#b ^ this.#b >>> 9;
        this.#b = this.#c + (this.#c << 3) | 0;
        this.#c = (this.#c << 21 | this.#c >>> 11);
        this.#c = this.#c + t | 0;
        return (t >>> 0) / BIT32_SPACE;
    }

    get seed () { return [this.#seedA, this.#seedB, this.#seedC, this.#seedD] }
}
