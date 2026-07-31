import { TrackableObject } from "../utils/tracking/TrackableObject.js";
import { typeString } from "../utils/logging.js";
import { AudioLayer } from "./AudioLayer.js";
import { AudioSource } from "./AudioSource.js";

export class AudioContext extends TrackableObject {
    static #INSTANCES = new Array();
    static #MAX_INSTANCES = 1;
    #context;
    #sources = {}; // store a master copy of all audio buffers
    constructor () {
        super();
        if (AudioContext.#INSTANCES.length >= AudioContext.#MAX_INSTANCES)
            throw new Error(`[${typeString(this)}]: Audio context limit exceeded`);
        else AudioContext.#INSTANCES.push(this);
        this.#context = new (window.AudioContext || window.webkitAudioContext)();
    }

    async decodeAudio (audioReadableStream) {
        if (this.isClosed) throw new Error(`[${typeString(this)}]: Failed to decode audio stream, instance is closed`);
        const buffer = await audioReadableStream.arrayBuffer();
        return await this.#context.decodeAudioData(buffer);
    }

    newBassNode () {
        if (this.isClosed) throw new Error(`[${typeString(this)}]: Failed to create node, instance is closed`);
        const node = new BiquadFilterNode(this.#context);
        node.type = "lowshelf";
        return node;
    }
    newVolumeNode () {
        if (this.isClosed) throw new Error(`[${typeString(this)}]: Failed to create node, instance is closed`);
        return new GainNode(this.#context);
    }
    newNode () {
        if (this.isClosed) throw new Error(`[${typeString(this)}]: Failed to create node, instance is closed`);
        return new GainNode(this.#context);
    }
    newBufferNode () {
        if (this.isClosed) throw new Error(`[${typeString(this)}]: Failed to create node, instance is closed`);
        const node = new AudioBufferSourceNode(this.#context);
        // add promise support
        {
            // onend (Promise) = onended (Function)
            const { promise, resolve, reject } = Promise.withResolvers();
            node.onended = () => { resolve() }
            node.onend = promise;
        }
        {
            // onstart (Promise)
            const { promise, resolve, reject } = Promise.withResolvers();
            const oldStart = node.start.bind(node);
            node.start = function (...args) {
                resolve();
                oldStart(...args);
            }
            node.onstart = promise;
        }
        return node;
    }
    Source (name, src) {
        if (this.isClosed) throw new Error(`[${typeString(this)}]: Failed to create audio source, instance is closed`);
        const source = new AudioSource(name, src, this);
        this.#sources[source.id] = source;
        return source;
    }
    Layer (filters = []) {
        if (this.isClosed) throw new Error(`[${typeString(this)}]: Failed to create audio layer, instance is closed`);
        const layer = new AudioLayer(this, filters);
        layer.connect(this.input);
        return layer;
    }
    close () {
        if (this.isClosed) console.warn(`[${typeString(this)}]: Failed close instance, already closed`);
        this.#context.close();
        const thisIdx = AudioContext.#INSTANCES.findIndex((ctx) => ctx.id === this.id);
        if (thisIdx === -1) throw new Error(`[${typeString(this)}]: Failed to dispose of instance, cannot be found in global list`);
        AudioContext.#INSTANCES.splice(thisIdx, 1);
        return true;
    }
    wake () { if (this.isSuspended) this.#context.resume() }

    get isAudioContext () { return true }
    get time () { return this.#context.currentTime }
    get sources () { return Object.entries(this.#sources).map(([id, {name}]) => {id, name}) }
    get input () { return this.#context.destination }
    get isClosed () { return this.#context.state === "closed" }
    get isSuspended () { return this.#context.state === "suspended" }
}
