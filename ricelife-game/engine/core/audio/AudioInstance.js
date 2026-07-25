import { TrackableObject } from "../utils/tracking/TrackableObject.js";
import { generateUUID } from "../utils/tracking/UUID.js";

// replayable audio node
export class AudioInstance extends TrackableObject {
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
        this.#node.start(this.#start + this.#offset);
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
        this.#connected[audio.id || generateUUID()] = audio;
        this.#connect(audio);
        return audio; // for chaining
    }

    get isAudioInstance () { return true }
    get playing () { return this.#playing }
    set playing (value) {
        if (value) this.play();
        else this.pause();
    }
    get offset () { return this.#offset }
    set offset (value) { return  (this.#offset = value) }
    get name () { return this.#source.name }
    get onend () { return this.#node.onend }
    get onstart () { return this.#node.onstart }
}