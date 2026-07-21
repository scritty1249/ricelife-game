import { AssetPool } from "../lobby/lobby.js";
import { TrackableObject } from "../utils/utils.js";
import { EventController } from "../controller/events.js";

export class GameLoop extends TrackableObject {
    static STATES = {
        Crashed: -1,
        Closed: 0,
        Ready: 1,
        Raise: 2,
        Busy: 3,
    };
    #AssetPool = new AssetPool();
    #AssetTable = {};
    #Events = new EventController();
    #Audio = {
        Context: undefined,
        Player: undefined,
        Layer: {}
    };
    #flags = {};
    #store = {};
    #state = GameLoop.STATES.Busy;
    constructor (audioContext) {
        super();
        this.#Audio.Context = audioContext;
        this.#Audio.Player = audioContext.Layer();
    }

    async loop () {
        const { Crashed, Closed } = this.constructor.STATES;
        if (this.state === Crashed || this.state === Closed) return;
        // don't loop unless method has been overrided by child
        if (this.loop !== GameLoop.prototype.loop)
            requestAnimationFrame(() => this.loop());
    }
    async tick (delta) {}
    async loadAsset (key, ...args) {
        this.AssetPool.add(key, args?.length ? args : this.AssetTable[key]);
        return await this.AssetPool.onready(key);
    }
    close () {
        this.state = this.constructor.STATES.Busy;
        this.Audio.Player.stop();
        this.state = this.constructor.STATES.Closed;
    }

    get isGameLoop () { return true }
    get AssetTable () { return this.#AssetTable }
    get AssetPool () { return this.#AssetPool }
    get Audio () { return this.#Audio }
    get Threaded () { return false }
    get Events () { return this.#Events }
    get onload () { return Promise.resolve(this) }
    get flags () { return this.#flags }
    get store () { return this.#store }
    get state () { return this.#state }
    set state (value) { return (this.#state = value) }
}
Object.freeze(GameLoop.STATES);
