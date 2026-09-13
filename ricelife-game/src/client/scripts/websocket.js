import { createClient } from "@supabase/supabase-js";

export class LobbyEventListener {
    static #CHANNEL_CONFIG = {
        broadcast: {
            ack: false,
            self: false
    }};
    static #attachListener (event, channel, callbackFn) {
        
    }
    #callbacks = {};
    #client;
    #channel;
    constructor (url, key, id) {
        this.#client = createClient(url, key);
        this.#channel = this.client.channel(id, {
            config: LobbyEventListener.#CHANNEL_CONFIG
        });        
    }

    #registerEventType (event) {
        this.#callbacks[event] = new Map();
        this.channel
            .on("broadcast", { event },
                (payload) => this.#callbackHandler(event, payload))
            .subscribe();
    }
    #callbackHandler (event, payload) {
        if (event in this.#callbacks)
            for (const callback of this.#callbacks[event].keys())
                callback?.(payload);
    }

    send (event, payload) {
        this.channel.send({
            event,
            type: "broadcast",
            payload: payload || {}
        });
    }
    attach (event, callbackFn) {
        if (!(event in this.#callbacks))
            this.#registerEventType(event);
        this.#callbacks[event].set(callbackFn, null);
    }
    remove (event, callbackFn) {
        if (event in this.#callbacks)
            this.#callbacks[event].delete(callbackFn);
    }

    get client () { return this.#client }
    get channel () { return this.#channel }
}