import { typeString } from "../utils/logging.js";

// provides a View for parsing, interfacing with, and sending Lobby information
// [!] as the rest of the game's feature are added, this class will fill out more. Build around supporting it, even if it's sparse at the time of writing -KT
export class Lobby {
    // expects parsed JSON object
    static fromObject (lobbyJson) {
        try {
            return new Lobby(...lobbyJson.players);
        } catch (error) {
            console.error(`[${typeString(this)}]: Failed to deocde and parse data\n\t`, lobbyJson);
            throw error;
        }
    }
    #Players = new Map(); // immutable
    #Teams = {}; // immutable
    #Avatars = new Set(); // immutable
    #NameRegistry = {}; // immutable
    #ModelTypes = new Set(); // immutable
    #AmmoTypes = new Set(); // mutable
    #ActivePlayer; // current turn holder
    constructor (...players) {
        this.#init(players);
        this.#lock();
    }

    #init (players) {
        this.#populatePlayers(players);
    }
    #populatePlayers (players) {
        try {
            for (const player of players) {
                const { team, ammo, model } = player.data;
                const { userid, name, avatar } = player.data.profile;
                this.Avatars.add(avatar);
                this.ModelTypes.add(model);
                this.NameRegistry[userid] = name;
                this.Players.set(userid, player);
                if (team in this.Teams) this.Teams[team].push(player);
                else this.Teams[team] = [player];
                for (const a of ammo) this.AmmoTypes.add(a);
            }
        } catch (error) {
            console.error(`[${typeString(this)}]: Failed to populate players. Are all objects valid?`);
            throw error;
        }
    }
    #lock () {
        Object.freeze(this.#Teams);
        Object.freeze(this.#Avatars);
        Object.freeze(this.#Players);
        Object.freeze(this.#NameRegistry);
        Object.freeze(this.#ModelTypes);
    }

    async loadAssets (clientUserID, assetPool, ammoPool, assetTypes) {
        if (!this.Players.has(clientUserID)) throw new Error(`[${typeString(this)}]: Client UserID ${clientUserID} does not exist`);
        if (!assetPool?.isAssetPool) throw new Error(`[${typeString(this)}]: ${typeString(assetPool)} is not an AssetPool`);
        if (!ammoPool?.isAmmoPool) throw new Error(`[${typeString(this)}]: ${typeString(ammoPool)} is not an AmmoPool`);
        const modelPromises = [];
        const ammoPromises = [];
        // player models
        for (const modelType of this.ModelTypes) {
            const bodyKey = modelType + "/body";
            const barrelKey = modelType + "/barrel";
            assetPool.add(
                bodyKey,
                [assetTypes.Image, undefined, `./assets/tank/${bodyKey}.png`],
                barrelKey,
                [assetTypes.Image, undefined, `./assets/tank/${barrelKey}.png`]
            );
            modelPromises.push(
                assetPool.onready(bodyKey),
                assetPool.onready(barrelKey)
            );
        }
        // ammo imports
        for (const ammoType of this.AmmoTypes) {
            ammoPool.add(ammoType);
            ammoPromises.push(ammoPool.onready(ammoType));
        }
        await Promise.all(ammoPromises);
        await Promise.all(modelPromises);
    }

    get isLobby () { return true }
    get Teams () { return this.#Teams }
    get Players () { return this.#Players }
    get AmmoTypes () { return this.#AmmoTypes }
    get Avatars () { return this.#Avatars }
    get ModelTypes () { return this.#ModelTypes }
    get NameRegistry () { return this.#NameRegistry }
}
