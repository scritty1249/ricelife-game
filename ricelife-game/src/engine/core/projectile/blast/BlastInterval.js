export class BlastInterval {
    #blasts = new Array();
    #delay;
    #frame;
    #terrain;
    constructor (delay, terrain, frame = undefined, blasts = []) {
        this.#delay = delay;
        this.#frame = frame;
        this.#terrain = terrain;
        this.#blasts.push(...blasts);
    }

    get isBlastInterval () { return true }
    get blasts () { return this.#blasts }
    get delay () { return this.#delay }
    get frame () { return this.#frame }
    get terrain () { return this.#terrain }
}
