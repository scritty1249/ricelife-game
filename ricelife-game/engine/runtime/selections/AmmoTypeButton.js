import {
    ShapeButton,
    Color,
    Vector,
    Path,
    Equigon
} from "../../core/Core.js";

export class AmmoTypeButton extends ShapeButton {
    #typeSelection;
    hide = false; // when set, draw() will not do anything
    showText = true; // when unset, draw() will not draw text
    constructor (typeSelection, legLength) {
        const shape = new Equigon(6, legLength);
        shape.transform.scale.y = 0.85; // squish to make visually "even"
        shape.applyTransform();
        super(shape);
        this.#typeSelection = typeSelection;
    }

    drawButton (cursor, fixed = false) {
        if (this.hide) return;
        const selection = this.#typeSelection;
        const {
          fillColor,
          fontColor,
          borderColor,
          borderWidth,
          glowColor,
          glowRadius,
          glowResolution,
          name,
        } = selection;
        const totalScale = this.shape.globalTransformation.scale;
        const textOffset = selection.constructor.textOffsetScale
            .mul(this.shape.center)
            .add(this.shape.center, true);
        const hideText = totalScale.lengthSquared < TILE_MINIMIZE_SCALE;
        
        cursor.save();
        cursor.fixed = fixed;

        this.shape.draw(cursor, true);
        if (!selection.hasGlow ) {
            cursor.save();
            cursor.fillStyle = fillColor.toRGBA();
            cursor.fill();
            cursor.restore();
        }
    }
    drawText (cursor, offset = undefined, fixed = false) {
        if (!this.hide && this.showText)
            super.drawText(cursor, offset, fixed);
    }

    get isAmmoTypeButton () { return true }
}