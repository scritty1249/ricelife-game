import { AssetPool } from "../../lobby/lobby.js";
import { TrackableObject } from "../../utils/utils.js";

export class LoopController extends TrackableObject {
    static STATES = {
        Crashed: -1,
        Closed: 0,
        Ready: 1,
        Busy: 2,
    };
    #AssetPool = new AssetPool();
    #AssetTable = {};
    #Audio = {
        Context: undefined,
        Player: undefined,
        Layer: {}
    };
    #flags = {
        EXIT: false
    };
    #store = {};
    #state = LoopController.STATES.Busy;
    constructor (audioContext) {
        super();
        this.#Audio.Context = audioContext;
        this.#Audio.Player = audioContext.Layer();
    }

    async loop () {
        if (this.flags.EXIT) return;
        // don't loop unless method has been overrided by child
        if (this.loop !== LoopController.prototype.loop)
            requestAnimationFrame(() => this.loop());
    }
    async tick (delta) {}
    async loadAsset (key, ...args) { return this.AssetPool.add(key, args?.length ? args : this.AssetTable[key]).onload }
    exit () { this.flags.EXIT = true }
    close () {
        this.state = this.constructor.STATES.Busy;
        this.flags.EXIT = true;
        this.Audio.Player.stop();
        this.state = this.constructor.STATES.Closed;
    }

    get isLoopController () { return true }
    get AssetTable () { return this.#AssetTable }
    get AssetPool () { return this.#AssetPool }
    get Audio () { return this.#Audio }
    get Threaded () { return false }
    get onload () { return Promise.resolve(this) }
    get flags () { return this.#flags }
    get store () { return this.#store }
    get state () { return this.#state }
    set state (value) { return (this.#state = value) }
}
Object.freeze(LoopController.STATES);
