import { LoadPool } from "../core/load/pool/LoadPool.js";

export class AmmoPool extends LoadPool { 
    constructor (...ammoTypes) {
        super();
        if (ammoTypes?.length) this.add(...ammoTypes);
    }

    add (...ammoTypes) {
        if (!ammoTypes?.length) return;
        const entries = [];
        for (const ammoType of ammoTypes)
            entries.push(
                ammoType,
                import(`../ammotypes/${ammoType}.js`)
                    .then(({default: value}) => value)
            )
        super.add(...entries);
        return this; // for chaining
    }

    get isAmmoPool () { return true }
}
