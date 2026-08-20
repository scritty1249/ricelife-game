import { BoundingBox } from "../../geometry/BoundingBox.js";
import { Color } from "../../math/Color.js";
import { Vector } from "../../math/Vector.js";
import { clamp } from "../../math/utils.js";
import { MenuItem } from "../MenuItem.js";
import { typeString } from "../../utils/logging.js";
import { IconButton } from "./IconButton.js";

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
        color: new Color(),
        cornerRadius: 0
    };
    #dot;
    keepDragFocus = true;
    constructor (dotImage, max, min = 0, step = 1) {
        super();
        this.#dot = new IconButton(dotImage);
        this.onclick = (...args) => this.#onclick(...args);
        this.ondrag = (...args) => this.#ondrag(...args);
    }

    #setBackgroundPosition (position) {
        const { bbox } = this.#background;
        const { width, height } = bbox;
        bbox.min.apply(position.x, position.y - height);
        bbox.max.apply(position.x + width, position.y);
    }
    #setBarPosition (position) {
        const { bbox } = this.#bar;
        const { width, height } = bbox;
        const centerX = position.x + ((this.#hasBackgroundBbox ? this.#background.bbox.width : width) / 2);
        const centerY = position.y - (this.#background.bbox.height / 2);
        bbox.min.apply(centerX - (width / 2), centerY - (height / 2));
        bbox.max.apply(bbox.min.x + width, bbox.min.y + height);
    }
    #updateDotPosition () {
        const { bbox } = this.#bar;
        const x = ((this.progress * this.#bar.bbox.width) + this.#bar.bbox.min.x) - (this.dot.width / 2);
        const y = (this.#bar.bbox.max.y - (bbox.height / 2)) + (this.dot.height / 2);
        this.dot.setPosition(x, y);
    }
    #setValueToPoint (point) {
        this.value = point.x - this.#bar.bbox.min.x;
    }
    #onclick (position, delta, isTouch) {
        if (!this.#bar.bbox.isIntersecting(position)) return;
        this.#setValueToPoint(position);
    }
    #ondrag (position, origin, delta, isTouch) {
        if (!(this.#bar.bbox.isIntersecting(origin) || this.dot.isOver(origin))) return;
        this.#setValueToPoint(position);
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
        this.#setBackgroundPosition(this.#position);
        this.#setBarPosition(this.#position);
        this.#updateDotPosition();
    }
    isOver (point) {
        return this.dot.isOver(point)
            || this.#bar.bbox.isIntersecting(point)
            || (this.#hasBackgroundBbox && this.#background.bbox.isIntersecting(point));
    }
    getBoundingBox (includeDot = false) {
        const bboxes = [this.#background.bbox, this.#bar.bbox];
        if (includeDot) bboxes.push(this.dot.getBoundingBox());
        return BoundingBox.merge(bboxes);
    }

    get isSlider () { return true }
    get value () { return clamp(Math.round(this.#state.value / this.step) * this.step, this.min, this.max) }
    set value (num) { this.#state.value = num; return this.value }
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
    get dot () { return this.#dot }
    get backgroundColor () { return this.#background.color }
    get backgroundCornerRadius () { return this.#background.cornerRadius }
    set backgroundCornerRadius (radians) { return (this.#background.cornerRadius = radians) }
    get barColor () { return this.#bar.color }
    get barCornerRadius () { return this.#bar.cornerRadius }
    set barCornerRadius (radians) { return (this.#bar.cornerRadius = radians) }
    get #hasBackgroundBbox () { return this.#background.bbox.extentSquared > 0 }
    get #hasBarBbox () { return this.#bar.bbox.extentSquared > 0 }
}