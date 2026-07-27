import { Vector, Color } from "../../core/Core.js";

// houses cosmetic data for AmmoTypes
export class AmmoTypeSelection {
    static textOffsetScale = new Vector(0, -.3);
    name;
    fontSize = 24;
    fontFamily = "serif";
    borderWidth = 5;
    glowRadius = 25;
    glowResolution = 10;
    #icon;
    #glowColor = new Color(0, 0, 0, 0);
    #borderColor = new Color(255, 255, 255);
    #fillColor = new Color(70, 70, 70, .8);
    #fontColor = new Color(255, 255, 255);

    constructor (name, icon) {
        this.name = name;
        this.#icon = icon;
    }

    get isAmmoTypeSelection () { return true }
    get hasGlow () { return this.glowColor.visible && this.glowRadius && this.glowResolution }
    get icon () { return this.#icon }
    get fontColor () { return this.#fontColor }
    get glowColor () { return this.#glowColor }
    get borderColor () { return this.#borderColor }
    get fillColor () { return this.#fillColor }
    get fontStyle () { return `${this.fontSize}px ${this.fontFamily}` }
}
