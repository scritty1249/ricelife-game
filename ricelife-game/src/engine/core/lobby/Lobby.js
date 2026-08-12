import { typeString } from "../utils/logging.js";
import { Model } from "../player/Model.js";
import { Profile } from "../player/Profile.js";
import { Metadata } from "../player/Metadata.js";
import { HitTotal } from "../player/HitTotal.js";
import { Actor } from "../player/Actor.js";
import { Vector } from "../math/Vector.js";

// [!] placeholder
import { Color } from "../math/Color.js";
const TEAM_COLOR = {
    ally: new Color(0, 0, 255),
    self: new Color(0, 255, 0),
    enemy: new Color(255, 0, 0)
};

// provides a View for parsing, interfacing with, and sending Lobby information
// [!] as the rest of the game's feature are added, this class will fill out more. Build around supporting it, even if it's sparse at the time of writing -KT
export class Lobby {
    // expects parsed JSON object
    static fromObject (lobbyJson) {
        try {
            return new Lobby(lobbyJson);
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
    #ActivePlayerID; // current turn holder
    constructor (lobbyJson) {
        this.#init(lobbyJson);
        this.#lock();
    }

    #getAffiliation (clientUserID, otherUserID) {
        const client = this.Players.get(clientUserID);
        const other = this.Players.get(otherUserID);
        return clientUserID === otherUserID
            ? "self"
            : client?.data?.team === other?.data?.team
                ? "ally"
                : "enemy";
    }
    #getModelKeys (clientUserID, player) {
        const { model } = player.data;
        const affiliation = this.#getAffiliation(clientUserID, player.data.profile.userid);
        const modelPrefix = `${model}.${affiliation}`;
        return {
            body: modelPrefix + ".body",
            barrel: modelPrefix + ".barrel",
            color: TEAM_COLOR[affiliation]
        };
    }
    #init (lobbyJson) {
        this.#populatePlayers(Object.values(lobbyJson.players));
        this.#ActivePlayerID = lobbyJson.activeplayer;
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
        const avatarPromises = [];
        const modelAccentColor = new Color(255, 0, 0);
        const modelAccentFeatherTolerance = 50;
        // player models
        for (const [ id, player ] of this.Players) {
            const modelKeys = this.#getModelKeys(clientUserID, player);
            const { model } = player.data;
            if (!assetPool.has(modelKeys.body)) {
                assetPool.add(
                    modelKeys.body,
                    [assetTypes.EditableImage, undefined, `/assets/tank/${model}/body.png`]
                );
                modelPromises.push(
                    assetPool.onready(modelKeys.body)
                        .then((img) =>
                            swapImageColors(img, modelAccentColor, modelKeys.color, modelAccentFeatherTolerance))
                );
            }
            if (!assetPool.has(modelKeys.barrel)) {
                assetPool.add(
                    modelKeys.barrel,
                    [assetTypes.EditableImage, undefined, `/assets/tank/${model}/barrel.png`]
                );
                modelPromises.push(
                    assetPool.onready(modelKeys.barrel)
                        .then((img) =>
                            swapImageColors(img, modelAccentColor, modelKeys.color, modelAccentFeatherTolerance))
                );
            }
        }
        // ammo imports
        for (const ammoType of this.AmmoTypes) {
            ammoPool.add(ammoType);
            ammoPromises.push(ammoPool.onready(ammoType));
        }
        // player avatars
        for (const avatar of this.Avatars) {
            assetPool.add(
                avatar,
                [assetTypes.Image, undefined, avatar]
            );
            avatarPromises.push(assetPool.onready(avatar));
        }
        await Promise.all(ammoPromises);
        await Promise.all(modelPromises);
        await Promise.all(avatarPromises);
    }
    generatePlayerActors (clientUserID, assetPool, actorMap, hitpointMap, terrain = undefined) {
        if (!this.Players.has(clientUserID)) throw new Error(`[${typeString(this)}]: Client UserID ${clientUserID} does not exist`);
        if (!assetPool?.isAssetPool) throw new Error(`[${typeString(this)}]: ${typeString(assetPool)} is not an AssetPool`);
        for (const [ id, player ] of this.Players) {
            const modelKeys = this.#getModelKeys(clientUserID, player);
            const model = new Model(
                player.data.model,
                assetPool.get(modelKeys.body).clone(false),
                assetPool.get(modelKeys.barrel).clone(false)
            );
            const profile = new Profile(
                player.data.profile.name,
                assetPool.get(player.data.profile.avatar).clone(false),
                id
            );
            const metadata = new Metadata(model, profile, player.data.team);
            const hittotal = new HitTotal(...Array.from(player.hitpoints,
                (hitpoints) => hitpointMap[String(hitpoints.type)].fromObject(hitpoints)
            ));
            const actor = new Actor(metadata, hittotal);
            actor.onload.then(() => {
                actor.Mover.Terrain = terrain;
                const invalidMsg = `[${typeString(this)}]: Invalid position from object for player ${profile.name} (${id})`;
                if (player.position) {
                    const position = Vector.fromObject(player.position);
                    if (!(
                        !position.equals(0)
                        && actor.Mover.apply(position)
                    )) console.warn(invalidMsg);
                } else console.warn(invalidMsg);
                actor.Aimer.update(actor.Puppet.position.add({x: 0, y: actor.Aimer.radius * 2})); // aim straight up and set power to 100%
            });
            actorMap.set(id, actor);
        }
    }

    get isLobby () { return true }
    get Teams () { return this.#Teams }
    get Players () { return this.#Players }
    get AmmoTypes () { return this.#AmmoTypes }
    get Avatars () { return this.#Avatars }
    get ModelTypes () { return this.#ModelTypes }
    get NameRegistry () { return this.#NameRegistry }
    get ActivePlayerID () { return this.#ActivePlayerID }
}
