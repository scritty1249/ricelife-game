import { PlayerModel } from "./model.js";
import { PlayerProfile } from "./profile.js";

// wraps all player related data
export class PlayerData {
    static fromObject (obj) {
        const { profile, hitpoints, model, team } = obj;
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
    constructor (model, hitpoints, profile, team = 1) {
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
