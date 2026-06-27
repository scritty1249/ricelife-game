import * as HITPOINT_TYPES from "./types.js";

export const HitPointTypes = HITPOINT_TYPES;

// assigned to each player
export class HitPoints {
    static fromObject (obj) {
        const layers = Array.from(obj, (o) => HITPOINT_TYPES[o.type].fromObject(o));
        return new HitPoints(...layers);
    }
    #layers = new Array();
    constructor (bottomLayer, ...layers) {
        this.push(bottomLayer, ...layers);
    }

    // returns the remaining damage, if any, after all layers have dropped to zero amount.
    // expects amount to be positive
    damage (amount) {
        let rollover = amount;
        while (rollover > 0 && !this.currentLayer.isZero)
            rollover += this.currentLayer.update(-rollover);
        return rollover;
    }
    push (...layers) {
        if (layers.some((layer) => !layer?.isHitAmount)) throw new Error(`[${this.constructor.name}]: Layers must be of type HitAmount`);
        this.#layers.push(...layers);
    }
    pop () { 
        return this.#layers.pop();
    }
    insert (index, ...layers) {
        if (layers.some((layer) => !layer?.isHitAmount)) throw new Error(`[${this.constructor.name}]: Layers must be of type HitAmount`);
        this.#layers.splice(index, 0, ...layers);
    }
    remove (index, deleteCount = 1) {
        this.#layers.splice(index, deleteCount);
    }
    layer (index) {
        return this.#layers.at(index);
    }
    toJSON () {
        return this.#layers.map((layer) => layer.toJSON());
    }

    get isHitPoints () { return true }
    get isZero () { return this.baseLayer.isZero } // if base layer is zero, player is dead.
    get baseLayer () { return this.#layers[0] }
    get length () { return this.#layers.length }
    get currentLayer () { return this.#layers[this.currentLayerIndex] }
    get currentLayerIndex () {
        for (let i = this.#layers.length - 1; i >= 0; i--)
            if (!this.#layers[i].isZero) return i;
        return 0;
    }
}