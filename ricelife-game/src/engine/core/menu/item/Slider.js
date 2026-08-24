import { BoundingBox } from "../../geometry/BoundingBox.js";
import { Color } from "../../math/Color.js";
import { Vector } from "../../math/Vector.js";
import { clamp } from "../../math/utils.js";
import { MenuItem } from "../MenuItem.js";
import { typeString } from "../../utils/logging.js";

export class Slider extends MenuItem {
    #position = new Vector();
    #state = {
        value: 0,
        min: 0,
        max: 10,
        step: 1
    };
    #background = {
        bbox: new BoundingBox(),
        color: new Color(),
        cornerRadius: 0
    };
    #bar = {
        bbox: new BoundingBox(),
        color: new Color(0, 0, 0, 1),
        cornerRadius: 0
    };
    #dot;
    #dotOffset = new Vector();
    keepDragFocus = true;
    constructor (dotButton, max, min = 0, step = 1) {
        super();
        this.#dot = dotButton;
        this.max = max;
        this.min = min;
        this.step = step;
        this.onclick = (...args) => this.#onclick(...args);
        this.ondrag = (...args) => this.#ondrag(...args);
        this.onhold = (...args) => this.#onhold(...args);
        this.dot.ondrag = (...args) => this.#onhold(...args);
    }

    #setBackgroundPosition (position, margin = 0) {
        const { bbox } = this.#background;
        const { width, height } = bbox;
        bbox.min.apply(position.x, position.y - height);
        bbox.max.apply(position.x + width, position.y);
        if (bbox.extent) {
            bbox.min.x += margin;
            bbox.min.y -= margin;
            bbox.max.x += margin;
            bbox.max.y -= margin;
        }
    }
    #setBarPosition (position, margin = 0) {
        const { bbox } = this.#bar;
        const { width, height } = bbox;
        const centerX = position.x + ((this.#hasBackgroundBbox ? this.#background.bbox.width : width) / 2);
        const centerY = position.y - (this.#background.bbox.height / 2);
        bbox.min.apply(centerX - (width / 2), centerY - height);
        bbox.max.apply(bbox.min.x + width, bbox.min.y + height);
        bbox.min.x += margin;
        bbox.min.y -= margin;
        bbox.max.x += margin;
        bbox.max.y -= margin;
    }
    #updateDotPosition () {
        const { bbox } = this.#bar;
        const offset = this.#dotOffset;
        const fullPadding = bbox.height;
        const padding = fullPadding / 2;
        const lengthX = this.#bar.bbox.width - fullPadding;
        const x = ((this.progress * lengthX) + (this.#bar.bbox.min.x + padding)) - (this.dot.width / 2);
        const y = (this.#bar.bbox.max.y - padding) + (this.dot.height / 2);
        this.dot.setPosition(x + offset.x, y - offset.y);
    }
    #setValueToPoint (point) {
        const range = this.#bar.bbox.max.x - this.#bar.bbox.min.x;
        const x = point.x - this.#bar.bbox.min.x;
        const amount = (this.max - this.min) * (x / range);
        this.value = this.min + amount;
        this.#updateDotPosition();
    }
    #onhold (position, isTouch) {
        this.#setValueToPoint(position);
    }
    #onclick (position, delta, isTouch) {
        this.#setValueToPoint(position);
    }
    #ondrag (position, origin, delta, isTouch) {
        this.#setValueToPoint(position);
        return true;
    }

    draw (cursor, fixed = false) {
        this.drawBackground(cursor, fixed);
        this.drawBar(cursor, fixed);
        this.drawDot(cursor, fixed);
    }
    drawDot (cursor, fixed = false) {
        if (!this.dot) return;
        this.dot.draw(cursor, fixed);
    }
    drawBar (cursor, fixed = false) {
        if (!this.barColor.visible || !this.#hasBarBbox) return;
        const { bbox, color, cornerRadius } = this.#bar;
        cursor.save();
        cursor.fixed = fixed;
        cursor.fillStyle = color.toString();
        bbox.drawRounded(cursor, cornerRadius, true);
        cursor.fill();
        cursor.restore();
    }
    drawBackground (cursor, fixed = false) {
        if (!this.backgroundColor.visible || !this.#hasBackgroundBbox) return;
        const { bbox, color, cornerRadius } = this.#background;
        cursor.save();
        cursor.fixed = fixed;
        cursor.fillStyle = color.toString();
        bbox.drawRounded(cursor, cornerRadius, true);
        cursor.fill();
        cursor.restore();
    }
    getPosition () { return this.#position.clone() }
    setPosition (x, y = null) {
        this.#position.apply(x, y);
        const margin = this.#dotMargin;
        this.#setBackgroundPosition(this.#position, margin);
        this.#setBarPosition(this.#position, margin);
        this.#updateDotPosition();
    }
    isOver (point) {
        return this.dot.isOver(point)
            || this.#bar.bbox.isIntersecting(point)
            || (this.#hasBackgroundBbox && this.#background.bbox.isIntersecting(point));
    }
    getBoundingBox (includeDot = true) {
        const bbox = BoundingBox.merge([this.#background.bbox, this.#bar.bbox]);
        if (includeDot) {
            const margin = this.#dotMargin;
            bbox.min.y -= margin;
            bbox.max.x += margin;
        }
        return bbox;
    }

    get isSlider () { return true }
    get #dotMargin () {
        const bbox = this.dot.getBoundingBox();
        return Math.max((bbox.width / 2) - (this.#bar.bbox.height / 2), 0);
    }
    get value () { return clamp(Math.round(this.#state.value / this.step) * this.step, this.min, this.max) }
    set value (num) {
        this.#state.value = num;
        this.#updateDotPosition();
        return this.value;
    }
    get min () { return this.#state.min }
    set min (num) {
        if (num >= this.max)
            throw new Error(`[${typeString(this)}]: Cannot set minimum value to ${num} (results in a range of zero or less)`);
        if (this.value < num)
            this.#state.value = num;
        return (this.#state.min = num);
    }
    get max () { return this.#state.max }
    set max (num) {
        if (num <= this.min)
            throw new Error(`[${typeString(this)}]: Cannot set maximum value to ${num} (results in a range of zero or less)`);
        if (this.value > num)
            this.#state.value = num;
        return (this.#state.max = num);
    }
    get step () { return this.#state.step }
    set step (num) { return (this.#state.step = num) }
    get progress () { return (this.value - this.min) / this.max }
    get width () {
        const dotWidth = this.dot.width - this.dotOffset.x;
        const barWidth = Math.max(this.backgroundWidth, this.barWidth);
        return barWidth + (2 * dotWidth) + (2 * this.#dotMargin);
    }
    get height () {
        const dotHeight = this.dot.height - this.dotOffset.y;
        const barHeight = Math.max(this.backgroundHeight, this.barHeight);
        return barHeight + (2 * dotHeight) + (2 * this.#dotMargin);
    }
    get dot () { return this.#dot }
    get dotOffset () { return this.#dotOffset }
    get backgroundColor () { return this.#background.color }
    get backgroundWidth () { return this.#background.bbox.width }
    set backgroundWidth (num) {
        this.#background.bbox.max.x = this.#background.bbox.min.x + num;
        return num;
    }
    get backgroundHeight () { return this.#background.bbox.height }
    set backgroundHeight (num) {
        this.#background.bbox.max.y = this.#background.bbox.min.y + num;
        return num;
    }
    get backgroundCornerRadius () { return this.#background.cornerRadius }
    set backgroundCornerRadius (radians) { return (this.#background.cornerRadius = radians) }
    get barColor () { return this.#bar.color }
    get barWidth () { return this.#bar.bbox.width }
    set barWidth (num) {
        this.#bar.bbox.max.x = this.#bar.bbox.min.x + num;
        return num;
    }
    get barHeight () { return this.#bar.bbox.height }
    set barHeight (num) {
        this.#bar.bbox.max.y = this.#bar.bbox.min.y + num;
        return num;
    }
    get barCornerRadius () { return this.#bar.cornerRadius }
    set barCornerRadius (radians) { return (this.#bar.cornerRadius = radians) }
    get #hasBackgroundBbox () { return this.#background.bbox.extentSquared > 0 }
    get #hasBarBbox () { return this.#bar.bbox.extentSquared > 0 }
}