import { Button } from "./Button.js";
import { typeString } from "../../utils/logging.js";

export class IconButton extends Button {
    #icon;
    constructor (icon) {
        super();
        if (!icon?.isIcon) throw new Error(`[${typeString(this)}]: Expected Icon, got ${typeString(icon)}`);
        this.#icon = icon;
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
        const centerOffset = this.icon.size.div(2);
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
    get size () { return this.icon.size }
}
