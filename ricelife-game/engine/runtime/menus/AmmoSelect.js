import { Menu, Vector } from "../../core/Core.js";
import { AmmoTypeSelection } from "../selections/AmmoTypeSelection.js";

export class AmmoSelect extends Menu {
    constructor (phase, drawBackgroundFn, ammoTypes) {
        super (phase, drawBackgroundFn);
        this.#load(ammoTypes)
            .then(() => this.resolveLoad());
    }

}