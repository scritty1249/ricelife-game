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