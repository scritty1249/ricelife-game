import { PlayerInstance } from "../player/player.js";

// handle raw lobby object, before decoding
export class LobbyJSON {
    #teamCount;
    #mainPlayerId;
    #mainPlayerTeam;
    #playerInstances;

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
            // count number of teams
            // collect all model types
            const teams = new Set();
            this.#playerAvatars = new Set();
            this.#playerModels = new Set();
            this.#playerInstances = {};
            for (const playerJson of obj.players) {
                this.#playerInstances[playerJson.data.profile.userid] = playerJson;
                teams.add(playerJson.data.team);
                this.#playerAvatars.add(playerJson.data.profile.avatar);
                this.#playerModels.add(playerJson.data.model);
            }
            this.#teamCount = teams.size;
        }
        {
            // set main player id
            // set main player team id (find outside of loop, so we can determine if it exists in the lobby or not)
            this.#mainPlayerId = obj.self;
            this.#mainPlayerTeam = this.#playerInstances[this.#mainPlayerId].data.team;
        }
    }

    // pass non-primitives by value
    models () { return Array.from(this.#playerModels) }
    avatars () { return Array.from(this.#playerAvatars) }
    teamCount () { return this.#teamCount }
    mainPlayerTeam () { return this.#mainPlayerTeam }
    mainPlayerId () { return this.#mainPlayerId }
    // yield initalized PlayerInstances 
    *playerInstances () {
        {
            // return "main" player first
            const main = PlayerInstance.fromObject(this.#playerInstances[this.#mainPlayerId], "self");
            main.isMain = true;
            yield main;
        } 
        for (const [id, obj] of Object.entries(this.#playerInstances)) {
            if (id === this.#mainPlayerId) continue;
            const modelVariant = obj.data.team === this.#mainPlayerTeam
                    ? "ally" : "enemy";
            yield PlayerInstance.fromObject(obj, modelVariant);
        }
    }
}
