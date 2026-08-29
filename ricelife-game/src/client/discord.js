import { DiscordSDK, RPCCloseCodes } from "@discord/embedded-app-sdk";

export class DiscordApp {
    static async #getClientID (serverEndpoint) {
        return await fetch(serverEndpoint, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
        })
        .then((resp) => resp.json())
        .then(({ id }) => id)
        .catch((err) => undefined);
    }
    static async #getAuthorizationToken (serverEndpoint, clientCode) {
        const response = await fetch(serverEndpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ code: clientCode }),
        });
        const { token } = await response.json();
        return token || null;
    }
    #load = {
        ...Promise.withResolvers(),
        ready: false
    };
    #sdk;
    #user;
    #participants = new Array();
    constructor (endpoint, scopes) {
        this.#init(endpoint)
            .then(() => this.#loadSdk(endpoint, scopes || []))
            .then(() => this.#load.ready = true)
            .then(() => this.#load.resolve(this))
            .catch((err) => this.#load.reject(err));
    }

    async #init (serverEndpoint) {
        const clientID = await DiscordApp.#getClientID(serverEndpoint);
        if (!clientID) throw new Error("Failed to retrieve Discord client ID from server");
        this.#sdk = new DiscordSDK(clientID);
        await this.sdk.ready();
        console.info("Discord SDK ready");
    }
    async #loadSdk (serverEndpoint, scopes) {
        const { code } = await this.sdk.commands.authorize({
            client_id: client_id,
            response_type: "code",
            state: "",
            prompt: "none",
            scope: [...scopes],
        }); 

        const token = await DiscordApp.#getAuthorizationToken(serverEndpoint, code);
        if (token === null) throw new Error("Failed to get authorization token for Discord SDK");

        const auth = await this.#authenticateSdk(token);
        if (auth === null) throw new Error("Failed to authenticate Discord SDK");
        console.info("Discord SDK authenticated");

        await this.#getUserdata(auth?.user);
        console.info("Discord SDK loaded");
    }
    async #authenticateSdk (token) {
        return await this.sdk.commands.authenticate({ access_token: token }) || null;
    }
    async #getUserdata (user) {
        this.#user = user;
        const participants = await this.sdk.commands.getInstanceConnectedParticipants();
        if (participants)
            for (const participant of participants)
                this.participants.push(participant);
        Object.freeze(this.#participants);
    }

    // closes the Discord Application (not just the SDK)
    closeApp (message) {
        this.sdk.close(RPCCloseCodes.CLOSE_NORMAL, message || "");
    }

    get onload () { return this.#load.promise }
    get ready () { return this.#load.ready }
    get sdk () { return this.#sdk }
    get user () { return this.#user }
    get participants () { return this.#participants }
}