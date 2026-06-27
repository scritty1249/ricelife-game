import { HitAmount } from "./hitamount.js";
import { Color } from "../geometry/geometry.js";

export class Health extends HitAmount {
    static #barColorStops = {
        base: [
            [0, new Color("#59ff6a").toString()],
            [.5, new Color("#1da32a").toString()],
            [1, new Color("#0c5c14").toString()],
        ],
        shine: [
            [0, new Color(255, 255, 255, 0).toRGBA()],
            [.3, new Color(255, 255, 255, .6).toRGBA()],
            [.7, new Color(255, 255, 255, .2).toRGBA()],
            [1, new Color(255, 255, 255, 0).toRGBA()],
        ]
    };
    static ROUNDING_FN = Math.round;
    constructor (max) {
        super(max);
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
                for (const [step, color] of Health.#barColorStops.base)
                    gradient.addColorStop(step, color);
                return gradient;
            }
        };
        const shineGradient = {
            composite: "lighter",
            style (cursor, x, y) {
                const Y = cursor.normalizeY(y);
                const gradient = cursor.ctx.createLinearGradient(x, Y, x + self.bar.width, Y);
                for (const [step, color] of Health.#barColorStops.shine)
                    gradient.addColorStop(step, color);
                return gradient;
            }
        };
        self.bar.fillPatterns.splice(0, self.bar.fillPatterns.length, baseGradient, shineGradient);
    }

    get isHealth () { return true }
}

export class Shield extends HitAmount {
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
