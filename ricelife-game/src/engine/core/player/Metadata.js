import { Model } from "./Model.js";
import { Profile } from "./Profile.js";
import { Loadable } from "../load/Loadable.js";

// wraps all loadable player data
export class Metadata extends Loadable {
    #team;
    #Profile;
    #Model;
    #loadPromise;
    #ready = false;
    constructor (model, profile, team) {
        super();
        this.#Profile = profile;
        this.#Model = model;
        this.#team = team;
        this.#loadPromise = Promise.all([this.Profile.onload, this.Model.onload])
            .then(() => this.#ready = true)
            .then(() => this);
    }

    toJSON () {
        return {
            profile: this.Profile.toJSON(),
            model: this.Model.type,
            team: this.team
        };
    }

    get isMetadata () { return true }
    get onload () { return this.#loadPromise }
    get ready () { return this.#ready }
    get Profile () { return this.#Profile }
    get Model () { return this.#Model }
    get team () { return this.#team }
}
