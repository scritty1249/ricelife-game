import { Color } from "../../math/Color.js";
import { equals } from "../../math/utils.js";
import { MenuItem } from "../MenuItem.js";

export class Button extends MenuItem {
    #fontColor = new Color(0, 0, 0, 1);
    #textSizing = {
        width: 0,
        height: 0,
        hasUpdate: true
    };
    #text = "";
    fontSize = 24;
    fontFamily = "Arial";

    computeTextSizing (cursor) {
        if (this.text) {
            cursor.save();
            cursor.font = this.fontStyle;
            const { width, height } = cursor.measureText(this.text);
            cursor.restore();
            this.#textSizing.width = width;
            this.#textSizing.height = height;
        } else {
            this.#textSizing.width = 0;
            this.#textSizing.height = 0;
        }
        this.#textSizing.hasUpdate = false;
    }
    draw (cursor, fixed) {
        this.drawButton(cursor, fixed);
        this.drawText(cursor, undefined, fixed);
    }
    drawButton (cursor, fixed = false) {}
    drawText (cursor, offset = undefined, fixed = false) {
        if (this.#textSizing.hasUpdate) this.computeTextSizing(cursor);
        if (!this.fontColor.visible || !this.text) return;
        cursor.save();
        cursor.fixed = fixed;
        cursor.font = `bold ${this.fontStyle}`;
        cursor.fillStyle = this.fontColor.toString();
        cursor.textAlign = "center";
        cursor.textBaseline = "middle";
        const position = this.getPosition(); // clone
        if (offset?.isVector)
            position.add(offset, true);
        cursor.fillText(this.text, position);
        cursor.restore();
    }

    get isButton () { return true }
    get isTextOverflowing () { return this.#textSizing.width > this.width || this.#textSizing.height > this.height }
    get textSizing () { return this.#textSizing }
    get text () { return this.#text }
    set text (str) {
        if (this.text !== str)
            this.#textSizing.hasUpdate = true;
        return (this.#text = str);
    }
    get fontColor () { return this.#fontColor }
    get fontStyle () { return `${this.fontSize}px ${this.fontFamily}` }
}