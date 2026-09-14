import { Loadable } from "../load/Loadable.js";
import { AudioInstance } from "./AudioInstance.js";
import { typeString } from "../utils/logging.js";

// these exist as a master key - only one should exist per source/file
export class AudioSource extends Loadable {
    #src;
    #buffer;
    #ctx;
    #name; // does not need to be unique
    #state = {
        promise: undefined,
        resolve: undefined,
        reject: undefined,
        ready: false
    };
    constructor (name, src, ctx) {
        super();
        this.#name = name;
        ({promise: this.#state.promise, resolve: this.#state.resolve, reject: this.#state.reject} = Promise.withResolvers());
        this.#src = src;
        if (!ctx?.isAudioContext) throw new Error(`[${typeString(this)}]: Bad parameter, no ${AudioContext.name} given`);
        this.#ctx = ctx;
        this.#loadAudioBuffer();
    }

    async #loadAudioBuffer () {
        try {
            const resp = await fetch(this.#src);
            this.#buffer = await this.#ctx.decodeAudio(resp);
            this.#state.ready = true;
            this.#state.resolve(this); // for chaining
        } catch (error) {
            this.#state.ready = false; // extra redundancy
            this.#state.reject(new Error(`[${typeString(this)}]: Failed to load audio file ${this.#src}\n\t${error?.message}\n\tFile: ${error?.filename}\n\tLine: ${error?.lineno}`));
        }
    }

    bufferNode () {
        if (!this.ready) throw new Error(`[${typeString(this)}]: Failed to create new audio node, buffer not ready`);
        const node = this.#ctx.newBufferNode();
        node.buffer = this.source;
        return node;
    }
    Instance () {
        if (!this.ready) throw new Error(`[${typeString(this)}]: Failed to create new audio instance, buffer not ready`);
        const instance = new AudioInstance(this);
        instance.onstart.then(() => {
            if (this.#ctx.isClosed) console.warn(`[${instance.constructor.name}]: Played audio will not be audible, ${this.#ctx.constructor.name} is closed.`);
            else if (this.#ctx.isSuspended) this.#ctx.wake(); // [!] could cause performance bloat
        });
        return instance;
    }

    get isAudioSource () { return true }
    get onload () { return this.#state.promise }
    get ready () { return this.#state.ready }
    get name () { return this.#name }
    get time () { return this.#ctx.time }
    get source () { return this.#buffer }
}