import { createClient } from "@supabase/supabase-js";

export class LobbyEventListener {
    static WEBSOCKET_ROUTING_PREFIX = "/websocket";
    static WEBSOCKET_DUMMY_ENDPOINT = new URL("https://discord-proxy");
    static #CHANNEL_CONFIG = {
        broadcast: {
            ack: false,
            self: false
    }};
    static #CLIENT_OPTIONS = {
        auth: { persistSession: false },
        global: {
            // Intercept HTTP API calls (Auth, REST, Storage)
            fetch: (src, options) => {
                const { WEBSOCKET_ROUTING_PREFIX, WEBSOCKET_DUMMY_ENDPOINT } = LobbyEventListener;
                const { hostname } = WEBSOCKET_DUMMY_ENDPOINT;
                const relativeUrl = src.replace(`https://${hostname}`, WEBSOCKET_ROUTING_PREFIX);
                return fetch(relativeUrl, options);
            }
        },
        realtime: {
            endpoint: `${window.location.origin}${LobbyEventListener.WEBSOCKET_ROUTING_PREFIX}/realtime/v1`,
            getWebSocketTransport: (url) => {
                // skips parsing
                return new WebSocket(url);
            }
        }
    };
    #callbacks = {};
    #connected = false;
    #presenceState = new Map();
    #client;
    #channel;
    constructor (key, id, userid) {
        this.#init(key);
        this.#channel = this.client.channel(id, {
            config: {
                ...LobbyEventListener.#CHANNEL_CONFIG,
                presence: userid || ""
            }
        });
        this.attach("sync", () => this.#updateCurrentState());
    }

    #init (key) {
        this.#client = createClient(LobbyEventListener.WEBSOCKET_DUMMY_ENDPOINT.toString(), key, LobbyEventListener.#CLIENT_OPTIONS);
    }
    #registerEventType (event) {
        this.#callbacks[event] = new Map();
        this.channel
            .on("broadcast", { event },
                (payload) => this.#callbackHandler(event, payload));
    }
    #callbackHandler (event, payload) {
        if (event in this.#callbacks)
            for (const callback of this.#callbacks[event].keys())
                callback?.(payload);
    }
    #updateCurrentState () {
        if (!this.#channel) return;
        const state = this.#channel.presenceState();
        for (const userid of Object.keys(state)) {
            const sessions = state[userid];
            const recent = sessions[sessions.length - 1]; 
            if (this.#presenceState.has(userid))
                Object.assign(this.#presenceState.get(userid), recent);
            else
                this.#presenceState.set(userid, recent);
        }
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
    connect () {
        if (this.isConnected) return;
        this.channel.subscribe((status) => {
            if (status === "SUBSCRIBED") {
                this.#connected = true;
                console.info("Supabase websocket connected");
                this.syncState({online: true});
            } else
                console.warn("Supabase websocket failed to connect");
        });
    }
    disconnect () {
        if (this.isConnected) {
            this.syncState({online: false});
        }
        if (this.#client && this.#channel) {
            this.#client.removeChannel(this.#channel);
            this.#connected = false;
            console.info("Supabase websocket disconnected");
        }
    }
    syncState (payload) {
        if (this.isConnected) {
            const p = payload || {};
            this.channel.track(p);
            console.debug(`Synced state to websocket: `, p);
        }
    }

    get isConnected () { return this.#connected }
    get client () { return this.#client }
    get channel () { return this.#channel }
    get lobbyState () { return this.#presenceState }
}