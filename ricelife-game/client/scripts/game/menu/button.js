import { TrackableObject, floatEqual } from "../utils/utils.js";
import { Vector, Color, BoundingBox, Polygon, Poly } from "../geometry/geometry.js";

export class Icon extends TrackableObject {
    #img;
    #hash;
    #bbox = new BoundingBox();
    #position = new Vector();
    constructor (image) {
        super();
        this.#img = image;
        this.#bbox.apply(undefined, this.#img.size);
    }

    draw (cursor) {
        this.#img.draw(cursor, this.position.x, this.position.y);
    }

    getBoundingBox () {
        const hash = Vector.hashVectors([this.position, this.#img.size]);
        if (hash !== this.#hash) {
            this.#hash = hash;
            const { size } = this.#img;
            const min = this.position.clone();
            const max = min.clone();
            min.y -= size.y;
            max.x += size.x;
            this.#bbox.apply(min, max);
        }
        return this.#bbox;
    }

    get isIcon () { return true }
    get source () { return this.#img }
    get width () { return this.#img.width }
    get height () { return this.#img.height }
    get position () { return this.#position }
}

export class Button extends TrackableObject {
    #callback = {
        // these need to be set as non-functions by default for isSupported checks to work
        onclick: undefined,
        onhold: undefined,
        ondrag: undefined,
        onpress: undefined,
        onrelease: undefined,
        onscroll: undefined
    };
    #fontColor = new Color(0, 0, 0, 1);
    fontSize = 24;
    fontFamily = "Arial";
    text = "";
    keepDragFocus = false; // when set, drag events will continue even after pointer leaves this button's area
    constructor () {
        super();
    }

    draw (cursor, fixed) {
        this.drawButton(cursor, fixed);
        this.drawText(cursor, undefined, fixed);
    }
    drawText (cursor, offset = undefined, fixed = false) {
        if (floatEqual(this.fontColor.a, 0) || !this.text) return;
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
    get onclick () { return this.#callback.onclick }
    set onclick (callbackFn) { return (this.#callback.onclick = callbackFn) }
    get onhold () { return this.#callback.onhold }
    set onhold (callbackFn) { return (this.#callback.onhold = callbackFn) }
    get ondrag () { return this.#callback.ondrag }
    set ondrag (callbackFn) { return (this.#callback.ondrag = callbackFn) }
    get onpress () { return this.#callback.onpress }
    set onpress (callbackFn) { return (this.#callback.onpress = callbackFn) }
    get onrelease () { return this.#callback.onrelease }
    set onrelease (callbackFn) { return (this.#callback.onrelease = callbackFn) }
    get onscroll () { return this.#callback.onscroll }
    set onscroll (callbackFn) { return (this.#callback.onscroll = callbackFn) }

    // [!] should be overridden by children
    drawButton (cursor, fixed = false) {}
    isOver (point) { return false }
    getBoundingBox () { return new BoundingBox() }
    setPosition (x, y = null) {}
    getPosition () { return new Vector() }
    get width () { return 0 }
    get height () { return 0 }
    get fontColor () { return this.#fontColor }
    get fontStyle () { return `${this.fontSize}px ${this.fontFamily}` }
}

export class IconButton extends Button {
    #icon;
    constructor (image) {
        super();
        this.#icon = new Icon(image);
    }

    drawButton (cursor, fixed = false) {
        cursor.save();
        cursor.fixed = fixed;
        this.icon.draw(cursor)
        cursor.restore();
    }
    drawText (cursor, offset = undefined, fixed = false) {
        cursor.save();
        cursor.fixed = fixed;
        const centerOffset = new Vector(this.width / 2, -this.height / 2);
        if (offset?.isVector) super.drawText(cursor, offset.add(centerOffset), fixed);
        else super.drawText(cursor, centerOffset, fixed);
        cursor.restore();
    }
    getBoundingBox () { return this.icon.getBoundingBox() }
    setPosition (x, y = null) { this.icon.position.apply(x, y) }
    getPosition () { return this.icon.position.clone() }
    isOver (point) { return this.getBoundingBox().isIntersecting(point) }

    get isIconButton () { return true }
    get icon () { return this.#icon }
    get width () { return this.icon.width }
    get height () { return this.icon.height }
}

export class ShapeButton extends Button {
    #fillColor = new Color(0, 0, 0, 0);
    #strokeColor = new Color(0, 0, 0, 0);
    #shape;
    constructor (shape, fill = undefined, stroke = undefined) {
        super();
        this.#shape = shape;
        if (fill?.isColor) this.fillColor.apply(fill);
        if (stroke?.isColor) this.strokeColor.apply(stroke);
    }

    drawButton (cursor, fixed = false) {
        const hasFill = !floatEqual(this.fillColor.a, 0);
        const hasStroke = !floatEqual(this.strokeColor.a, 0);
        cursor.save();
        cursor.fixed = fixed;
        if (hasFill) cursor.fillStyle = this.fillColor.toString();
        if (hasStroke) cursor.strokeStyle = this.strokeColor.toString();
        this.shape.draw(cursor, true);
        if (hasFill) cursor.fill();
        if (hasStroke) cursor.stroke();
        cursor.restore();
    }
    getBoundingBox () { return this.shape.getBoundingBox() }
    setPosition (x, y = null) {
        const { shape } = this;
        const { transformation } = shape;
        const point = new Vector(x, y).sub(shape.origin, true);
        transformation.save();
        transformation.reset();
        transformation.offset.apply(point);
        shape.applyTransformation();
        transformation.restore();
    }
    getPosition () { return this.shape.origin.clone() }
    isOver (point) { return this.shape.isIntersecting(point) }

    get isShapeButton () { return true }
    get fillColor () { return this.#fillColor }
    get strokeColor () { return this.#strokeColor }
    get shape () { return this.#shape }
    get width () { return this.getBoundingBox().width }
    get height () { return this.getBoundingBox().height }
}
