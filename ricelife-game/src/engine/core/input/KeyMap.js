import { typeString } from "../utils/logging.js";

export class KeyMap {
    static fromObject (json) {
        const keyMap = new KeyMap();
        for (const [mapping, keyCodes] of Object.entries(json))
            for (const keyCode of keyCodes)
                keyMap.map(keyCode, mapping);
        return keyMap;
    }
    #mappings = new Map();
    constructor (mappingObj = undefined) {
        if (mappingObj)
            return this.constructor.fromObject(mappingObj);
    }

    #getMappingEntry (key) {
        if (this.mappings.has(key))
            return this.mappings.get(key);
        else {
            const entry = new Set();
            this.mappings.set(key, entry);
            return entry;
        }
    }

    map (keyCode, mapping) {
        const entry = this.#getMappingEntry(mapping);
        entry.add(keyCode);
    }
    isActive (keyboard, mapping) {
        if (keyboard?.KeyboardListener) throw new Error(`[${typeString(this)}]: Expected KeyboardListener, got ${typeString(keyboard)}`);
        if (!this.mappings.has(mapping)) return false;
        return this.mappings.get(mapping)
            .values()
            .some((keyCode) =>
                keyboard.keyActive(keyCode));
    }
    toJSON () {
        return Object.fromEntries(
            this.mappings.values()
                .map(([mapping, keyCodes]) =>
                    [mapping, Array.from(keyCodes)])
        );
    }

    get isKeyMap () { return true }
    get mappings () { return this.#mappings }
}
