import { HitPoints } from "../core/player/hitpoints/HitPoints.js";
import { Color } from "../core/math/Color.js";

export class Shield extends HitPoints {
    static #barColorStops = {
        base: [
            [0, new Color("#bbf1ff").toString()],
            [.3, new Color("#00b2ff").toString()],
            [.7, new Color("#0051ba").toString()],
            [1, new Color("#01123a").toString()]
        ],
        shine: [
            [0, new Color(255, 255, 255, 0).toRGBA()],
            [.2, new Color(255, 255, 255, .5).toRGBA()],
            [.8, new Color(255, 255, 255, .2).toRGBA()],
            [1, new Color(255, 255, 255, 0).toRGBA()]
        ]
    };
    constructor (max) {
        super(max);
        this.baseRegeneration = this.regeneration = this.max / 6;
        this.#setBarStyles();
    }

    #setBarStyles () {
        const self = this;
        self.bar.fillColor.R = 0;
        self.bar.fillColor.G = 0;
        self.bar.fillColor.B = 0;
        self.bar.fillColor.A = 0;
        const baseGradient = {
            composite: undefined,
            style (cursor, x, y) {
                const Y = cursor.normalizeY(y);
                const gradient = cursor.ctx.createLinearGradient(x, Y, x, Y + self.bar.height);
                for (const [step, color] of Shield.#barColorStops.base)
                    gradient.addColorStop(step, color);
                return gradient;
            }
        };
        const shineGradient = {
            composite: "lighter",
            style (cursor, x, y) {
                const Y = cursor.normalizeY(y);
                const gradient = cursor.ctx.createLinearGradient(x, Y, x + self.bar.width, Y);
                for (const [step, color] of Shield.#barColorStops.shine)
                    gradient.addColorStop(step, color);
                return gradient;
            }
        };
        self.bar.fillPatterns.splice(0, self.bar.fillPatterns.length, baseGradient, shineGradient);
    }

    get isShield () { return true }
}

HitPoints.TYPES.set(Shield.name, Shield);
console.debug(`HP type registered: ${Shield.name}`);
