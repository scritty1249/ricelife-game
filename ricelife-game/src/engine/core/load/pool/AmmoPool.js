import { LoadPool } from "./LoadPool.js";

export class AmmoPool extends LoadPool { 
    #importPath;
    constructor (importPath, ...ammoTypes) {
        super();
        this.#importPath = importPath;
        if (ammoTypes?.length) this.add(...ammoTypes);
    }

    #path (ammoType) { return `${this.importPath}/${ammoType}.js` }

    add (...ammoTypes) {
        if (!ammoTypes?.length) return;
        const entries = [];
        for (const ammoType of ammoTypes)
            entries.push(
                ammoType,
                import(this.#path(ammoType))
                    .then(({default: value}) => value)
            )
        super.add(...entries);
        return this; // for chaining
    }

    get isAmmoPool () { return true }
    get importPath () { return this.#importPath }
}
