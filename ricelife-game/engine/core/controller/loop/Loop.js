import { AssetPool } from "../../load/pool/AssetPool.js";
import { TrackableObject } from "../../utils/tracking/TrackableObject.js";
import { EventMap } from "../EventMap.js";
import { typeString } from "../../utils/logging.js";

export class Loop extends TrackableObject {
    static STATES = {
        Crashed: -1,
        Stopped: 0,
        Ready: 1,
        Raise: 2,
        Busy: 3,
    };
    #AssetPool = new AssetPool();
    #AssetTable = {};
    #Events = new EventMap();
    #Audio = {
        Context: undefined,
        Player: undefined,
        Layer: {}
    };
    #flags = {};
    #store = {};
    #state = Loop.STATES.Busy;
    #loadPromise = Promise.withResolvers();
    constructor (audioContext) {
        super();
        this.#Audio.Context = audioContext;
        this.#Audio.Player = audioContext.Layer();
    }

    async loop () {
        const { Crashed, Stopped } = this.constructor.STATES;
        if (this.state === Crashed || this.state === Stopped) return;
        // don't loop unless method has been overrided by child
        if (this.loop !== Loop.prototype.loop)
            requestAnimationFrame(() => this.loop());
    }
    async tick (delta) {}
    async loadAsset (key) {
        const { AssetTable } = this;
        if (!(key in AssetTable))
            throw new Error(`[${typeString(this)}]: "${key}" does not exist in local AssetTable`);
        this.AssetPool.add(key, AssetTable[key]);
        return await this.AssetPool.onready(key);
    }
    stop () {
        this.state = this.constructor.STATES.Busy;
        this.Audio.Player.stop();
        this.state = this.constructor.STATES.Stopped;
    }
    raiseCrashEvent (error) {
        const { Crashed } = this.constructor.STATES;
        console.error(`[${typeString(this)}]: Crashed${this.state === Crashed ? "" : " fatally"}\n\t`, error);
        this.state = Crashed;
        this.Events.raiseEvent("LOADING", {hide: false, message: "crashed", error: true});
    }
    rejectLoad (error) {
        this.raiseCrashEvent(error);
        this.#loadPromise.reject(error);
    }
    resolveLoad (value) {
        this.Events.raiseEvent("LOADING", {hide: true})
        this.state = this.constructor.STATES.Ready;
        this.#loadPromise.resolve(value || this);
    }

    get isLoop () { return true }
    get AssetTable () { return this.#AssetTable }
    get AssetPool () { return this.#AssetPool }
    get Audio () { return this.#Audio }
    get Threaded () { return false }
    get Events () { return this.#Events }
    get onload () { return this.#loadPromise.promise }
    get flags () { return this.#flags }
    get store () { return this.#store }
    get state () { return this.#state }
    set state (value) { return (this.#state = value) }
}

Object.freeze(Loop.STATES);
