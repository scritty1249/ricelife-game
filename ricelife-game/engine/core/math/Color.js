import { equals } from "./utils.js";
import { typeString } from "../utils/logging.js";

// [!] Color implementation will remain standalone, as a 2D game should never otherwise need 4D vectors.
export class Color {
    static #hexPattern = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})?$/;
    static fromObject (obj) { return new Color(obj.r, obj.g, obj.b, obj.a) }
    #r;
    #g;
    #b;
    #a;
    constructor (value = "#000000", g = undefined, b = undefined, a = 1) {
        this.apply(value, g, b, a);
    }

    apply (value, g = undefined, b = undefined, a = 1) {
        let matches, _;
        if (typeof value === "string"
            && (matches = value.match(Color.#hexPattern)))
            [_, this.r, this.g, this.b, this.a] = Array.from(matches, (match) => parseInt(match, 16));
        else if (typeof value === "object" && "r" in value && "g" in value && "b" in value)
            ({r: this.r, g: this.g, b: this.b, a: this.a} = value);
        else if (b !== undefined)
            [this.r, this.g, this.b, this.a] = [value, g, b, a];
        else
            throw new Error(`[${typeString(this)}]: Cannot apply invalid type ${typeString(value)}`);
        if (!Number.isFinite(this.a))
            this.a = 1
        return this; // for chaining
    }
    // [!] glorified Vector4 at this point...
    distance (color) {
        if (!color?.isColor) throw new Error(`[${typeString(this)}]: Cannot compute distance to ${typeString(color)}`);
        const dr = this.r - color.r;
        const dg = this.g - color.g;
        const db = this.b - color.b;
        const da = this.A - color.A;
        const sq = (dr * dr) + (dg * db) + (db * db) + (da * da);
        return Math.sqrt(sq);
    }
    lerp (color, factor, mutate = false, transparency = true) {
        if (!color?.isColor) throw new Error(`[${typeString(this)}]: Cannot linearly interpolate to ${typeString(color)}`);
        const clr = mutate ? this : this.clone();
        const mul = factor * (!transparency ? 1 - color.a : 1);
        clr.r += (color.r - clr.r) * mul;
        clr.g += (color.g - clr.g) * mul;
        clr.b += (color.b - clr.b) * mul;
        if (transparency) clr.A += (color.A - clr.A) * mul;
        return clr;
    }
    toJSON () { return {r: this.r, g: this.g, b: this.b, a: this.a} }
    toString () { return "#"
        + Math.floor(this.r).toString(16).padStart(2, "0")
        + Math.floor(this.g).toString(16).padStart(2, "0")
        + Math.floor(this.b).toString(16).padStart(2, "0")
        + (this.A < 255 ? Math.floor(this.A).toString(16).padStart(2, "0") : "");
    }
    toRGBA () { return `rgba(${this.r}, ${this.g}, ${this.b}, ${this.a})` }
    clone () { return new Color(this.r, this.g, this.b, this.a) }

    get isColor () { return true }
    get visible () { return !equals(this.a, 0) }
    get r () { return this.#r }
    get g () { return this.#g }
    get b () { return this.#b }
    get a () { return this.#a / 255 }
    get A () { return this.#a }
    set r (number) { return (this.#r = Color.#setValue(number)) }
    set g (number) { return (this.#g = Color.#setValue(number)) }
    set b (number) { return (this.#b = Color.#setValue(number)) }
    set a (number) { return (this.#a = Color.#setValue(number * 255)) }
    set A (number) { return (this.#a = Color.#setValue(number)) }

    static #setValue (value) { return clamp(value, 0, 255) }
}
