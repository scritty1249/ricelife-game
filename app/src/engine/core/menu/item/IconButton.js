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
        this.icon.draw(cursor, fixed);
    }
    getBoundingBox () { return this.icon.getBoundingBox() }
    setPosition (x, y = null) { this.icon.position.apply(x, y).sub(this.originOffset, true) }
    getPosition () { return this.icon.position.add(this.originOffset) }
    isOver (point) { return this.getBoundingBox().isIntersecting(point) }

    get isIconButton () { return true }
    get icon () { return this.#icon }
    get width () { return this.icon.width }
    get height () { return this.icon.height }
    get size () { return this.icon.size }
}
