import { PlayerInstance } from "../player/player.js";

// handle raw lobby object, before decoding
export class LobbyJSON {
    #teamCount;
    #mainPlayerId;
    #mainPlayerTeam;
    #playerInstances;
    #ammoTypes;
    // models and avatars are full of unique links of images / assets to load
    #playerModels;
    #playerAvatars;

    #isLoaded = false;
    constructor (jsonObj) {
        this.#loadObject(jsonObj);
    }

    /*
     * (current) Lobby JSON struct
     *
     * self: String (Snowflake)
     * players: Array <PlayerInstance>
     *      position: Vector
     *          x: Number
     *          y: Number
     *      hitpoints: HitPoints (Array <HitAmount>)
     *          type: String
     *          max: Integer
     *          amount: Integer
     *          regen: Number
     *          reserve: Number
     *          increase: Number
     *          decrease: Number
     *      data: PlayerData
     *          model: String (model type)
     *          ammo: Array <String>
     *          team: Integer
     *          profile: PlayerProfile
     *              name: String
     *              avatar: String (url)
     *              fontFamily: String
     *              userid: String (Snowflake)
     * 
     */
    #loadObject (obj) {
        if (this.#isLoaded) return;
        this.#isLoaded = true;
        {
            // set main player id
            this.#mainPlayerId = obj.self;
            // set main player team
            for (const { data } of obj.players) {
                if (data.profile.userid === this.#mainPlayerId) {
                    this.#mainPlayerTeam = data.team;
                    break;
                }
            }
        }
        {
            // count number of teams
            // collect all model types
            const teams = new Set();
            this.#playerAvatars = new Set();
            this.#playerModels = new Set();
            this.#ammoTypes = new Set();
            this.#playerInstances = {};
            for (const playerJson of obj.players) {
                this.#playerInstances[playerJson.data.profile.userid] = playerJson;
                teams.add(playerJson.data.team);
                this.#playerAvatars.add(playerJson.data.profile.avatar);
                this.#playerModels.add(
                    playerJson.data.model + "/"
                    + (playerJson.data.profile.userid === this.#mainPlayerId
                        ? "self" : playerJson.data.team === this.#mainPlayerTeam
                            ? "ally" : "enemy"));
                for (const ammoType of playerJson.data.ammo)
                    this.#ammoTypes.add(ammoType);
            }
            this.#teamCount = teams.size;
        }
    }

    // pass non-primitives by value
    avatars () { return Array.from(this.#playerAvatars) }
    modelTypes () { return Array.from(this.#playerModels) }
    ammoTypes () { return Array.from(this.#ammoTypes) }
    teamCount () { return this.#teamCount }
    mainPlayerTeam () { return this.#mainPlayerTeam }
    mainPlayerId () { return this.#mainPlayerId }
    // yield initalized PlayerInstances 
    *playerInstances () {
        {
            // return "main" player first
            const main = PlayerInstance.fromObject(this.#playerInstances[this.#mainPlayerId]);
            main.isMain = true;
            yield main;
        } 
        for (const [id, obj] of Object.entries(this.#playerInstances)) {
            if (id === this.#mainPlayerId) continue;
            yield PlayerInstance.fromObject(obj);
        }
    }
}
