import { createClient } from "@supabase/supabase-js";

export class LobbyEventListener {
    static WEBSOCKET_ROUTING_PREFIX = "/websocket";
    static WEBSOCKET_DUMMY_ENDPOINT = new URL("https://discord-proxy");
    static LOCAL_ENDPOINT = new URL(window.location.origin);
    static #CHANNEL_CONFIG = {
        broadcast: {
            ack: false,
            self: false
    }};
    static #CLIENT_OPTIONS = {
        auth: { persistSession: false },
        global: {
            fetch: (src, options) => {
                const { WEBSOCKET_ROUTING_PREFIX, WEBSOCKET_DUMMY_ENDPOINT } = LobbyEventListener;
                const { hostname } = WEBSOCKET_DUMMY_ENDPOINT;
                const url = String(src).replace(`https://${hostname}`, WEBSOCKET_ROUTING_PREFIX);
                return fetch(url, options);
            }
        },
        realtime: {
            getWebSocketTransport: (src) => {
                const { WEBSOCKET_ROUTING_PREFIX, WEBSOCKET_DUMMY_ENDPOINT, LOCAL_ENDPOINT } = LobbyEventListener;
                const { hostname } = WEBSOCKET_DUMMY_ENDPOINT;
                const url = new URL(src);
                url.protocol = LOCAL_ENDPOINT.protocol === "https:" ? "wss:" : "ws:";
                url.host = LOCAL_ENDPOINT.host;
                url.pathname = `${WEBSOCKET_ROUTING_PREFIX}${url.pathname}`; 
                return new WebSocket(url.toString());
            }
        }
    };
    #callbacks = {};
    #connected = false;
    #presenceState = new Map();
    #peers = new Set();
    #client;
    #channel;
    constructor (key, id, userid) {
        this.#init(key);
        this.#channel = this.client.channel(id, {
            config: {
                ...LobbyEventListener.#CHANNEL_CONFIG,
                presence: { key: userid || "" }
            }
        });
        this.#attachPresenceListeners();
    }

    #init (key) {
        this.#client = createClient(LobbyEventListener.WEBSOCKET_DUMMY_ENDPOINT.toString(), key, LobbyEventListener.#CLIENT_OPTIONS);
    }
    #attachPresenceListeners () {
        this.channel.on("presence", { event: "sync" }, () => this.#updateCurrentState());
        this.channel.on("presence", { event: "join" }, ({newPresences}) => {
            for (const userid of Object.keys(newPresences))
                this.#peers.add(userid);
        });
        this.channel.on("presence", { event: "leave" }, ({leftPresences}) => {
            for (const userid of Object.keys(leftPresences))
                this.#peers.delete(userid);
        });
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
            if (!sessions?.length) continue;
            const recent = sessions[sessions.length - 1]; 
            if (this.#presenceState.has(userid))
                Object.assign(this.#presenceState.get(userid), recent);
            else
                this.#presenceState.set(userid, recent);
        }
        this.#peers.clear();
        for (const [userid, { online = false }] of this.#presenceState.entries()) {
            if (online) this.#peers.add(userid);
            else this.#peers.delete(userid);
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
    get peers () { return this.#peers }
}