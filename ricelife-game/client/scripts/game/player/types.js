import { HitAmount } from "./hitamount.js";

export class Health extends HitAmount {
    static ROUNDING_FN = Math.round;
    constructor (max) {
        super(max);
        this.bar.fillColor.apply(136, 231, 136, 1); // "pastel green"
    }
    get isHealth () { return true }
}

export class Shield extends HitAmount {
    constructor (max) {
        super(max);
        this.baseRegeneration = this.regeneration = this.max / 6;
        this.bar.fillColor.apply(0, 0, 255, .4); // light blue?
    }
    get isShield () { return true }
}
