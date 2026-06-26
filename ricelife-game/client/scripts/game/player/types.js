import { HitAmount } from "./hitamount.js";

export class Health extends HitAmount {
    static ROUNDING_FN = Math.round;
    get isHealth () { return true }
}

export class Shield extends HitAmount {
    constructor (max) {
        super(max);
        this.baseRegeneration = this.regeneration = this.max / 6;
    }
    get isShield () { return true }
}
