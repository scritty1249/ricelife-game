import { HitPoints, HitPointTypes } from "./hitpoints.js";
import { PlayerModel } from "./model.js";
import { PlayerProfile } from "./profile.js";

// wraps all player related data
export class PlayerData {
    static fromObject (obj, team = 1) {
        const { profile, hitpoints, model } = obj;
        const suffix = team > 0
            ? "ally"
            : team < 0
                ? "enemy"
                : "self";
        const m = new PlayerModel(`${model}_${suffix}`);
        const p = PlayerProfile.fromObject(profile);
        const h = HitPoints.fromObject(hitpoints);
        return new PlayerData(m, h, p, team);
    }
    #team = 1; // 0 - self, 1 - ally, -1 - enemy
    #profile;
    #model;
    #hitpoints;
    constructor (model, hitpoints, profile, team = 1) {
        this.#profile = profile; // PlayerProfile
        this.#model = model; // PlayerModel
        this.#team = team;
        this.#hitpoints = new HitPoints(new HitPointTypes.Health(100), new HitPointTypes.Shield(20));
    }

    toJSON () {
        return {
            profile: this.profile.toJSON(),
            hitpoints: this.hitpoints.toJSON(),
            model: this.model.type
        };
    }

    get isPlayerData () { return true }
    get onload () { return Promise.all([this.profile.onload, this.model.onload]).then(() => this) }
    get profile () { return this.#profile }
    get model () { return this.#model }
    get team () { return this.#team }
    get hitpoints () { return this.#hitpoints }
}
