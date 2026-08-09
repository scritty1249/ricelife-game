import { Identifiable } from "../utils/tracking/Identifiable.js";
import { generateUUID } from "../utils/tracking/UUID.js";
import { typeString } from "../utils/logging.js";

export class AudioLayer extends Identifiable {
    #items = {};
    #filters = []; // [!] adding new nodes to this after initalization won't do anything
    #input;
    #output;
    #gain;
    #ctx;
    constructor (ctx, filters = []) {
        super();
        if (!ctx?.isAudioContext) throw new Error(`[${typeString(this)}]: Bad parameter, no ${AudioContext.name} given`);
        this.#ctx = ctx;
        this.#input = ctx.newNode();
        this.#output = ctx.newNode();
        this.#gain = ctx.newVolumeNode();
        if (filters.length) {
            this.#filters.push(...filters);
            for (let i = 0; i < filters.length; i++)
                (i === 0 ? this.#gain : filters[i-1]).connect(filters[i]);
            filters.at(-1).connect(this.#output);
        } else this.#gain.connect(this.#output);
        this.#input.connect(this.#gain);
    }

    play () { for (const item of this.items) item.play() }
    pause () { for (const item of this.items) item.pause() }
    stop () { for (const item of this.items) item.stop() }
    reset () { for (const item of this.items) item.reset() }
    add (audio, ephemeral = false) { // ephemeral will delete the audio after it is finished playing
        // can accept AudioInstance or AudioLayer
        audio.connect(this.#input);
        const id = generateUUID(); // allow for duplicates to be inserted, determine ID in layer class upon addition - KT
        this.#items[id] = audio;
        if (ephemeral) audio.onend.then(() => delete this.#items[id]);
        return audio; // for chaining
    }
    connect (audio) { // can accept AudioLayer or base AudioNode
        this.#output.connect(audio?.isAudioLayer ? audio.input : audio);
        return audio; // for chaining
    }
    Layer (filters = [], ephemeral = false) {
        const layer = new AudioLayer(this.#ctx, filters);
        return this.add(layer, ephemeral);
    }

    get isAudioLayer () { return true }
    get items () { return Object.values(this.#items) }
    get onend () { return Promise.all(Object.values(this.#items).map(({onend}) => onend)) }
    get input () { return this.#input }
    get output () { return this.#output }
    get volume () { return this.#gain.gain.value }
    set volume (value) { return (this.#gain.gain.value = value) }
    get filters () { return this.#filters }
    get playing () { return this.items.some(({playing}) => playing) }
    set playing (value) {
        if (value) this.play();
        else this.pause();
    }
}