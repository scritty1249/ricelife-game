import { TrackableObject, uuid } from "../utils/utils.js";

export class AudioContext extends TrackableObject {
    static #INSTANCES = new Array();
    static MAX_INSTANCES = 1;
    #context;
    #sources = {}; // store a master copy of all audio buffers
    constructor () {
        super();
        if (AudioContext.#INSTANCES.length >= AudioContext.#MAX_INSTANCES)
            throw new Error(`[${this.constructor.name}]: Audio context limit exceeded`);
        else AudioContext.#INSTANCES.push(this);
        this.#context = new (window.AudioContext || window.webkitAudioContext)();
    }

    async decodeAudio (audioReadableStream) {
        if (this.isClosed) throw new Error(`[${this.constructor.name}]: Failed to decode audio stream, instance is closed`);
        const buffer = await audioReadableStream.arrayBuffer();
        return await this.#context.decodeAudioData(buffer);
    }

    newVolumeNode () {
        if (this.isClosed) throw new Error(`[${this.constructor.name}]: Failed to create node, instance is closed`);
        return new GainNode(this.#context);
    }
    newNode () {
        if (this.isClosed) throw new Error(`[${this.constructor.name}]: Failed to create node, instance is closed`);
        return new AudioNode(this.#context);
    }
    newBufferNode () {
        if (this.isClosed) throw new Error(`[${this.constructor.name}]: Failed to create node, instance is closed`);
        const node = new AudioBufferSourceNode(this.#context);
        // add promise support
        const { promise, resolve, reject } = Promise.withResolvers();
        node.onended = () => { resolve() }
        node.onend = promise;
        return node;
    }
    Source (name, src) {
        if (this.isClosed) throw new Error(`[${this.constructor.name}]: Failed to create audio source, instance is closed`);
        const source = new AudioSource(name, src, this);
        this.#sources[source.id] = source;
        return source;
    }
    Layer (filter = []) {
        if (this.isClosed) throw new Error(`[${this.constructor.name}]: Failed to create audio layer, instance is closed`);
        const layer = new AudioLayer(this, filters);
        layer.connect(this.input);
        return layer;
    }
    close () {
        if (this.isClosed) console.warn(`[${this.constructor.name}]: Failed close instance, already closed`);
        this.#context.close();
        const thisIdx = AudioContext.#INSTANCES.findIndex((ctx) => ctx.id === this.id);
        if (thisIdx === -1) throw new Error(`[${this.constructor.name}]: Failed to dispose of instance, cannot be found in global list`);
        AudioContext.#INSTANCES.splice(thisIdx, 1);
        return true;
    }

    get isAudioContext () { return true }
    get time () { return this.#context.currentTime }
    get sources () { return Object.entries(this.#sources).map(([id, {name}]) => {id, name}) }
    get input () { return this.#context.destination }
    get isClosed () { return this.#context.state === "closed" } // allows for "running" and "suspended" states
}

// functionally different from similar classes (LoadImage), these classes exist as a master key - only one should exist per source/file
class AudioSource extends TrackableObject {
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
        ({promise: this.#state.promise, resolve: this.#state.resolve, reject: this.#state.reject} = Promise.withResolvers());
        this.#src = src;
        if (!ctx?.isAudioContext) throw new Error(`[${this.constructor.name}]: Bad parameter, no ${AudioContext.name} given`);
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
            this.#promise.reject(new Error(`[${this.constructor.name}]: Failed to load audio file ${this.#src}\n\t${error?.message}\n\tFile: ${error?.filename}\n\tLine: ${error?.lineno}`));
        }
    }

    bufferNode () {
        if (!this.#state.ready) throw new Error(`[${this.constructor.name}]: Failed to create new audio node, buffer not ready`);
        const node = this.#ctx.newBufferNode();
        node.buffer = this.#buffer;
        return node;
    }
    Instance () {
        if (!this.#state.ready) throw new Error(`[${this.constructor.name}]: Failed to create new audio instance, buffer not ready`);
        return new AudioInstance(this);
    }

    get isAudioSource () { return true }
    get onload () { return this.#state.promise }
    get name () { return this.#name }
    get time () { return this.#ctx.time }
}

class AudioInstance extends TrackableObject {
    #source;
    #node;
    #start = 0;
    #offset = 0;
    #playing = false;
    #connected = {}; // reconnect to all nodes when regenerating source node
    constructor (source) {
        super();
        this.#source = source;
        this.#newNode();
    }

    #connect (audio) {
        this.#node.connect(audio?.isAudioLayer ? audio.input : audio);
    }
    #newNode () {
        this.#node = this.#source.bufferNode();
        this.#node.onend.then(() => {
            this.#playing = false;
            this.reset();
        });
        for (const node of Object.values(this.#connected))
            this.#connect(node);
    }
    
    play () {
        this.#playing = true;
        this.#start = this.#source.time;
        this.#node.play(this.#start + this.#offset);
        this.#offset = 0;
        return this; // for chaining
    }
    stop () {
        if (this.#playing) {
            this.#playing = false;
            this.#offset = 0;
            this.#start = 0;
            this.#node.stop();
            this.#newNode();
        }
        return this; // for chaining
    }
    pause () {
        this.#playing = false;
        this.#offset = this.#source.time - this.#start;
        this.#node.stop();
        this.#newNode();
        return this; // for chaining
    }
    reset () {
        this.#offset = 0;
        this.#start = 0;
        if (this.#playing) this.stop();
        return this; // for chaining
    }
    connect (audio) {
        // can accept AudioLayer or base AudioNode
        this.#connected[audio.id || uuid()] = audio;
        this.#connect(audio);
        return audio; // for chaining
    }

    get isAudioInstance () { return true }
    get onend () { return Promise.all(this.#items.map(({onend}) => onend)) }
    get playing () { return this.#playing }
    set playing (value) {
        if (value) this.play();
        else this.pause();
    }
    get offset () { return this.#offset }
    set offset (value) { return  (this.#offset = value) }
    get name () { return this.#source.name }
    get onend () { return this.#node.onend }
}

class AudioLayer extends TrackableObject {
    #items = {};
    #input;
    #output;
    #gain;
    #ctx;
    constructor (ctx, filters = []) {
        super();
        if (!ctx?.isAudioContext) throw new Error(`[${this.constructor.name}]: Bad parameter, no ${AudioContext.name} given`);
        this.#ctx = ctx;
        this.#input = ctx.newNode();
        this.#output = ctx.newNode();
        this.#gain = ctx.newVolumeNode();
        if (filters.length) {
            for (let i = 0; i < filters.length; i++)
                (i === 0 ? this.#gain : filters[i-1]).connect(filters[i]);
            filters.at(-1).connect(this.#output);
        } else this.#gain.connect(this.#ouput);
        this.#input.connect(this.#gain);
    }

    play () { for (const item of this.#items) item.play() }
    pause () { for (const item of this.#items) item.pause() }
    stop () { for (const item of this.#items) item.stop() }
    reset () { for (const item of this.#items) item.reset() }
    add (audio) { // can accept AudioInstance or AudioLayer
        audio.connect(this.#input);
        const id = uuid(); // allow for duplicates to be inserted, determine ID in layer class upon addition - KT
        this.#items[id] = audio;
        audio.onend.then(() => delete this.#items[id]);
        return audio; // for chaining
    }
    connect (audio) { // can accept AudioLayer or base AudioNode
        this.#output.connect(audio?.isAudioLayer ? audio.input : audio);
        return audio; // for chaining
    }
    Layer (filters = []) {
        const layer = new AudioLayer(this.#ctx, filters);
        return this.add(layer);
    }

    get isAudioLayer () { return true }
    get items () { return Object.values(this.#items) }
    get onend () { return Promise.all(this.#items.map(({onend}) => onend)) }
    get input () { return this.#input }
    get output () { return this.#output }
    get volume () { return this.#gain.value }
    set volume (value) { return (this.#gain.value = value) }
}