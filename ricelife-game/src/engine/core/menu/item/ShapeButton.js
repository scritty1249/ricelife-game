import { Color } from "../../math/Color.js";
import { Vector } from "../../math/Vector.js";
import { equals } from "../../math/utils.js";
import { Button } from "./Button.js";

export class ShapeButton extends Button {
    #fillColor = new Color(0, 0, 0, 0);
    #strokeColor = new Color(0, 0, 0, 0);
    #shape;
    constructor (shape, fill = undefined, stroke = undefined) {
        super();
        if (!shape?.isShape) throw new Error(`[${typeString(this)}]: Expected Shape, got ${typeString(shape)}`);
        this.#shape = shape;
        if (fill?.isColor) this.fillColor.apply(fill);
        if (stroke?.isColor) this.strokeColor.apply(stroke);
    }

    drawButton (cursor, fixed = false) {
        const hasFill = !equals(this.fillColor.a, 0);
        const hasStroke = !equals(this.strokeColor.a, 0);
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
        const { transform } = shape;
        const point = new Vector(x, y).sub(shape.origin, true).sub(this.originOffset, true);
        transform.save();
        transform.reset();
        transform.offset.apply(point);
        shape.applyTransform();
        transform.restore();
    }
    getPosition () { return this.shape.origin.add(this.originOffset) }
    isOver (point) { return this.shape.isIntersecting(point) }

    get isShapeButton () { return true }
    get fillColor () { return this.#fillColor }
    get strokeColor () { return this.#strokeColor }
    get shape () { return this.#shape }
    get width () { return this.getBoundingBox().width }
    get height () { return this.getBoundingBox().height }
}
