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
    #Ammo = new Set(); // mutable
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
                this.NameRegistry[userid] = name;
                this.Players.set(userid, player);
                if (team in this.Teams) this.Teams[team].push(player);
                else this.Teams[team] = [player];
                for (const a of ammo) this.Ammo.add(a);
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
    }

    async loadAssets (clientUserID, assetPool, ammoPool) {
        if (!this.Players.has(clientUserID)) throw new Error(`[${typeString(this)}]: Client UserID ${clientUserID} does not exist`);
        if (!assetPool?.isAssetPool) throw new Error(`[${typeString(this)}]: ${typeString(assetPool)} is not an AssetPool`);
        if (!ammoPool?.isAmmoPool) throw new Error(`[${typeString(this)}]: ${typeString(ammoPool)} is not an AmmoPool`);
        return {

        };
    }

    get isLobby () { return true }
    get Teams () { return this.#Teams }
    get Players () { return this.#Players }
    get Ammo () { return this.#Ammo }
    get Avatars () { return this.#Avatars }
    get NameRegistry () { return this.#NameRegistry }
}
