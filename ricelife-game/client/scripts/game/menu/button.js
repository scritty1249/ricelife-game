import { TrackableObject, floatEqual } from "../utils/utils.js";
import { Vector, Color, BoundingBox, Polygon, Poly } from "../geometry/geometry.js";

export class Icon extends TrackableObject {
    #img;
    #hash;
    #bbox = new BoundingBox();
    #fontColor = new Color(0, 0, 0);
    text = "";
    fontSize = 24;
    fontFamily = "Arial";
    #position = new Vector();
    constructor (image) {
        super();
        this.#img = image;
        this.#bbox.apply(undefined, this.#img.size);
    }

    draw (cursor) {
        this.#img.draw(cursor, this.position.x, this.position.y);
        this.#drawText(cursor);
    }

    #drawText (cursor) {
        if (floatEqual(this.fontColor.a, 0) || !this.text) return;
        cursor.save();
        cursor.font = `bold ${this.fontSize}px ${this.fontFamily}`;
        cursor.fillStyle = this.fontColor.toString();
        cursor.textAlign = "center";
        cursor.textBaseline = "middle";
        cursor.fillText(this.text, this.position.x + (this.width / 2), this.position.y - (this.height / 2));
        cursor.restore();
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
    get fontColor () { return this.#fontColor }
    get position () { return this.#position }
}

export class Button extends TrackableObject {
    #callback = {
        // these need to be set as non-functions by default for isSupported checks to work
        onclick: undefined,
        onhold: undefined,
        ondrag: undefined,
        onpress: undefined,
        onrelease: undefined
    };
    constructor () {
        super();
    }

    get isButton () { return true }
    get onclick () { return this.#callback.onclick }
    set onclick(callbackFn) { return (this.#callback.onclick = callbackFn) }
    get onhold () { return this.#callback.onhold }
    set onhold(callbackFn) { return (this.#callback.onhold = callbackFn) }
    get ondrag () { return this.#callback.ondrag }
    set ondrag(callbackFn) { return (this.#callback.ondrag = callbackFn) }

    // [!] should be overridden by children
    draw (cursor) {}
    isOver (point) { return false }
    getBoundingBox () { return new BoundingBox() }
    setPosition (x, y = null) {}
    getPosition () { return new Vector() }
    get width () { return 0 }
    get height () { return 0 }
    get position () { return new Vector() }
}

export class IconButton extends Button {
    #icon;
    constructor (image) {
        super();
        this.#icon = new Icon(image);
    }

    draw (cursor) { this.icon.draw(cursor) }
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

    draw (cursor) {
        const hasFill = !floatEqual(this.fillColor.a, 0);
        const hasStroke = !floatEqual(this.strokeColor.a, 0);
        cursor.save();
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
