import { Color } from "../../math/Color.js";
import { Vector } from "../../math/Vector.js";
import { typeString } from "../../utils/logging.js";
import { equals } from "../../math/utils.js";

// visual counterpart for HitPoints
export class HitBar {
    #fillColor = new Color(0, 255, 0, 1);
    #fillPatterns = new Array();
    #emptyColor = new Color(0, 0, 0, 0);
    #emptyPatterns = new Array();
    #size = new Vector();
    #hitpoints;
    constructor (hitpoints) {
        if (!hitpoints?.isHitPoints) throw new Error(`[${typeString(this)}]: Expected HitPoints, got ${typeString(hitpoints)}`);
        this.#hitpoints = hitpoints;
    }

    drawEmpty (cursor, x, y) {
        const { height } = this;
        const width = this.emptyWidth;
        if (!width) return;
        if (!equals(this.emptyColor.A, 0)) {
            cursor.save();
            cursor.fillStyle = this.emptyColor.toString();
            cursor.fillRect(x, y, width, height);
            cursor.restore();
        }
        for (const { style, composite } of this.emptyPatterns) {
            if (!style) continue;
            cursor.save();
            cursor.fillStyle = style(cursor, x, y);
            if (composite) cursor.globalCompositeOperation = composite;
            cursor.fillRect(x, y, width, height);
            cursor.restore();
        }
    }
    drawFilled (cursor, x, y) {
        const { height } = this;
        const width = this.filledWidth;
        if (!width) return;
        if (!equals(this.fillColor.A, 0)) {
            cursor.save();
            cursor.fillStyle = this.fillColor.toString();
            cursor.fillRect(x, y, width, height);
            cursor.restore();
        }
        for (const { style, composite } of this.fillPatterns) {
            if (!style) continue;
            cursor.save();
            cursor.fillStyle = style(cursor, x, y);
            if (composite) cursor.globalCompositeOperation = composite;
            cursor.fillRect(x, y, width, height);
            cursor.restore();
        }
    }
    draw (cursor, position, center = true) {
        if (this.size.isZero) return;
        // calculate rectangles
        const startX = center ? position.x - this.width / 2 : position.x;
        const startY = position.y - this.height / 2;
        const midX = startX + (this.width * this.#hitpoints.percentage);
    
        cursor.save();
        cursor.beginPath();
        cursor.rect(startX, cursor.normalizeY(startY), this.width, this.height);
        cursor.clip();

        this.drawEmpty(cursor, midX, startY);
        this.drawFilled(cursor, startX, startY);

        cursor.restore();
    }

    get isHitBar () { return true }
    get fillColor () { return this.#fillColor }
    get fillPatterns () { return this.#fillPatterns }
    get emptyColor () { return this.#emptyColor }
    get emptyPatterns () { return this.#emptyPatterns }
    get size () { return this.#size }
    get width () { return this.size.x }
    set width (pixels) { return (this.size.x = pixels) }
    get height () { return this.size.y }
    set height (pixels) { return (this.size.y = pixels) }
    get emptyWidth () { return this.width - this.filledWidth }
    get filledWidth () { return this.width * this.#hitpoints.percentage }
}
