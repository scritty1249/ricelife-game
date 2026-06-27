import { clamp, roundToPlace, floatEqual } from "../utils/utils.js";
import { Color, Vector } from "../geometry/geometry.js";

// parent class for health, shields, etc.
// final stored value of anything should never be a decimal. Clamp or round instead of throwing error
export class HitAmount {
    static ROUNDING_FN = Math.floor; // Can be reconfigured by children. (Math.floor | Math.ceil | Math.round | (value) => Integer )
    static fromObject (obj) {
        const { type, increase, decrease, amount, regen, max, reserve } = obj;
        const other = new this(max);
        other.increaseMultiplier = increase;
        other.decreaseMultiplier = decrease;
        other.amount = amount;
        other.reserve = reserve;
        other.regeneration = regen;
        return other;
    }
    // Multipliers may be decimal, negative, or zero.
    #baseDecreaseMultiplier = 1;
    #baseIncreaseMultiplier = 1;
    #decreaseMultiplier = 1;
    #increaseMultiplier = 1;
    #baseRegeneration = 0;
    #regeneration = 0; // may be a decimal, but makes no sense to be - KT
    #reserve = 0; // can be used to reduce maximum amount. May be a decimal. Cannot be more than max.
    #max;
    #amount;
    #bar;
    constructor (max) {
        // [!] idiot proofing
        // throw error here instead of rounding silently. Max should be exact on init
        if (!Number.isFinite(max) || !Number.isInteger(max) || !max) throw new Error(`[${this.constructor.name}]: Hit maximum must be a positive, finite integer`);
        this.#max = max;
        this.#amount = max;
        this.#bar = new HitAmountBar(this);
    }

    // methods that modify values should apply modifiers
    // returns amount clamped off, if any
    update (amount) { // used in-game changes to amount, like regen, health, or damage
        const change = amount * (
            amount > 0
                ? this.increaseMultiplier
                : amount < 0
                    ? this.decreaseMultiplier
                    : 0);
        const rounded = this.constructor.ROUNDING_FN(change + this.amount);
        const clamped = clamp(rounded, 0, this.limit);
        this.#amount = clamped;
        if (rounded < 0) return rounded;
        else if (rounded > this.limit) return rounded - this.limit;
        else return 0;
    }
    // returns amount clamped off, if any
    // does not apply multipliers
    set (value) {
        const rounded = this.constructor.ROUNDING_FN(value);
        const clamped = clamp(rounded, 0, this.limit);
        this.#amount = clamped;
        if (rounded < 0) return rounded;
        else if (rounded > this.limit) return rounded - this.limit;
        else return 0;
    }
    // adds (positively) to current amount. Does not apply multipliers
    // convenience function, apply between intervals in game loop
    regenerate () {
        this.set(this.amount + this.regeneration);
    }
    clone (deep = false) {
        const other = new this.constructor(this.max);
        other.baseIncreaseMultiplier = this.baseIncreaseMultiplier;
        other.baseDecreaseMultiplier = this.baseDecreaseMultiplier;
        other.increaseMultiplier = this.increaseMultiplier;
        other.decreaseMultiplier = this.decreaseMultiplier;
        other.regeneration = this.regeneration;
        if (deep) {
            other.amount = this.amount;
            other.reserve = this.reserve;
        }
        return other;
    }
    toJSON () {
        // base multipliers are modified by subclasses and should not be included when exporting data, as payload should include class type.
        return {
            type: this.constructor.name,
            increase: this.increaseMultiplier,
            decrease: this.decreaseMultiplier,
            amount: this.amount,
            regen: this.regeneration,
            max: this.max,
            reserve: this.reserve
        }
    }

    get isHitAmount () { return true }
    get percentage () { return this.amount / this.max }
    get isZero () { return this.amount === 0 } // amount should be an Integer
    get limit () { return this.max - this.reserve }
    get bar () { return this.#bar }
    get baseRegeneration () { return this.#baseRegeneration }
    set baseRegeneration (value) {
        // value is not rounded or limited
        if (!Number.isFinite(value)) throw new Error(`[${this.constructor.name}]: Invalid regeneration value ${value}`);
        return (this.#baseRegeneration = value);
    }
    get regeneration () { return this.#regeneration }
    set regeneration (value) {
        // value is not rounded or limited
        if (!Number.isFinite(value)) throw new Error(`[${this.constructor.name}]: Invalid regeneration value ${value}`);
        return (this.#regeneration = value);
    }
    // getters should return whole (raw) values
    // setters should bypass any multipliers / modifiers and only ensure values are sanitized before being set
    get max () { return this.#max }
    set max (value) {
        this.#max = this.constructor.ROUNDING_FN(value);
        this.amount = this.amount; // clamp whatever current amount is to new max
        return this.#max;
    }
    get reserve () { return this.#reserve }
    set reserve (value) {
        const result = this.constructor.ROUNDING_FN(value);
        // Cannot be more than max.
        if (result > this.max) throw new Error(`[${this.constructor.name}]: Amount reserved (${value} => ${result}) cannot be greater than maximum (${this.max})`);
        this.#reserve = result;
        this.amount = this.amount;  // clamp whatever current amount is to new limit
        return result;
    }
    get baseIncreaseMultiplier () { return this.#baseIncreaseMultiplier }
    set baseIncreaseMultiplier (value) {
        if (!Number.isFinite(value)) throw new Error(`[${this.constructor.name}]: Multiplier must be finite, got (${value})`);
        return (this.#baseIncreaseMultiplier = value);
    }
    get baseDecreaseMultiplier () { return this.#baseDecreaseMultiplier }
    set baseDecreaseMultiplier (value) {
        if (!Number.isFinite(value)) throw new Error(`[${this.constructor.name}]: Multiplier must be finite, got (${value})`);
        return (this.#baseDecreaseMultiplier = value);
    }
    get increaseMultiplier () { return this.#increaseMultiplier }
    set increaseMultiplier (value) {
        if (!Number.isFinite(value)) throw new Error(`[${this.constructor.name}]: Multiplier must be finite, got (${value})`);
        return (this.#increaseMultiplier = value);
    }
    get decreaseMultiplier () { return this.#decreaseMultiplier }
    set decreaseMultiplier (value) {
        if (!Number.isFinite(value)) throw new Error(`[${this.constructor.name}]: Multiplier must be finite, got (${value})`);
        return (this.#decreaseMultiplier = value);
    }
    get amount () { return this.#amount }
    set amount (value) { return (this.#amount = clamp(this.constructor.ROUNDING_FN(value), 0, this.limit)) }
}

export class HitAmountBar {
    #fillColor = new Color(0, 255, 0, 1);
    #fillPattern = undefined;
    #emptyColor = new Color(0, 0, 0, 0);
    #emptyPattern = undefined;
    #size = new Vector();
    #hitamount;
    blend = false; // whether to draw empty color and pattern below fill, or draw the two seperately
    constructor (hitamount) {
        if (!hitamount?.isHitAmount) throw new Error(`[${this.constructor.name}]: Invalid parameter - expected HitAmount, got ${typeof hitamount}`);
        this.#hitamount = hitamount;
    }

    drawEmpty (cursor, x, y, dx, dy) {
        cursor.save();
        if (!floatEqual(this.emptyColor.A, 0)) {
            cursor.fillStyle = this.emptyColor.toString();
            cursor.fillRect(x, y, dx, dy);
        }
        if (this.emptyPattern !== undefined) {
            cursor.fillStyle = this.emptyPattern;
            cursor.fillRect(x, y, dx, dy);
        }
        cursor.restore();
    }
    drawFilled (cursor, x, y, dx, dy) {
        cursor.save();
        if (!floatEqual(this.fillColor.A, 0)) {
            cursor.fillStyle = this.fillColor.toString();
            cursor.fillRect(x, y, dx, dy);
        }
        if (this.fillPattern !== undefined) {
            cursor.fillStyle = this.fillPattern;
            cursor.fillRect(x, y, dx, dy);
        }
        cursor.restore();
    }
    draw (cursor, position) {
        if (this.size.isZero) return;
        // calculate rectangles
        const halfWidth = this.width / 2;
        const halfHeight = this.height / 2;
        const fillWidth = this.width * this.#hitamount.percentage;

        const startX = position.x - halfWidth;
        const startY = position.y - halfHeight;
        const midX = startX + fillWidth;
        const endX = position.x + halfWidth;
        const endY = position.y + halfHeight;

        this.drawEmpty(
            cursor,
            this.blend ? startX : midX, startY,
            endX, endY
        );
        this.drawFilled(
            cursor,
            startX, startY,
            midX, endY
        );
    }

    get isHitAmountBar () { return true }
    get fillColor () { return this.#fillColor }
    get fillPattern () { return this.#fillPattern }
    set fillPattern (pattern) { return (this.#fillPattern = pattern) }
    get emptyColor () { return this.#emptyColor }
    get emptyPattern () { return this.#emptyPattern }
    set emptyPattern (pattern) { return (this.#emptyPattern = pattern) }
    get size () { return this.#size }
    get width () { return this.size.x }
    set width (pixels) { return (this.size.x = pixels) }
    get height () { return this.size.y }
    set height (pixels) { return (this.size.y = pixels) }
}
