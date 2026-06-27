import { PlayerModel } from "./model.js";
import { PlayerProfile } from "./profile.js";
import { HitPoints } from "./hitpoints.js";

// wraps all player related data
export class PlayerData {
    static fromObject (obj, modelVariant = "ally") {
        const { profile, model, team } = obj;
        const m = new PlayerModel(`${model}_${modelVariant}`);
        const p = PlayerProfile.fromObject(profile);
        return new PlayerData(m, p, team);
    }
    #team;
    #profile;
    #model;
    constructor (model, profile, team = 1) {
        this.#profile = profile; // PlayerProfile
        this.#model = model; // PlayerModel
        this.#team = team;
    }

    toJSON () {
        return {
            profile: this.profile.toJSON(),
            model: this.model.type,
            team: this.team
        };
    }

    get isPlayerData () { return true }
    get onload () { return Promise.all([this.profile.onload, this.model.onload]).then(() => this) }
    get profile () { return this.#profile }
    get model () { return this.#model }
    get team () { return this.#team }
}
