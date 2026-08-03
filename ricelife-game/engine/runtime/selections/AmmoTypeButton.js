import {
    ShapeButton,
    Color,
    Vector,
    Path,
    Equigon,
    typeString,
    equals,
    clamp
} from "../../core/Core.js";

export class AmmoTypeButton extends ShapeButton {
    static HIDE_SCALE = 0.0001; // sentinal value for transform scale. Hides the button if scale matches this value
    static HIDE_TEXT_SCALE = 0.45; // hide text if scale is below this value (exclusive)
    static MIN_SCALE = 0;
    static MAX_SCALE = 1.5;
    static SCALE_RATE = 3; // must be an Integer
    #typeDetails;
    hidden = false; // when set, draw() will not do anything
    fillFilter = "blur(10px)"; // [!] setting this over 30px causes massive framerate drop
    #layout = {
        totalSpace: undefined,
        halfSpace: undefined,
        rowSkew: undefined,
        maxDistance: undefined
    };
    #state = {
        lastScale: 1,
        distanceCoeff: 0
    };
    #textPadding = new Vector();
    constructor (typeDetails, legLength) {
        const shape = new Equigon(6, legLength);
        shape.transform.scale.y = 0.85; // squish to make visually "even"
        shape.applyTransform();
        super(shape);
        this.typeDetails = typeDetails;
    }

    #computeScale () {
        const { HIDE_SCALE, MIN_SCALE, MAX_SCALE } = this.constructor;
        const scale = clamp(this.#state.distanceCoeff, MIN_SCALE, MAX_SCALE);
        return equals(scale, 0)
            ? HIDE_SCALE
            : scale;
    }

    drawButton (cursor, fixed = false) {
        if (this.hide) return;
        const {
            fillColor,
            fontColor,
            borderColor,
            borderWidth,
            glowColor,
            glowRadius,
            glowResolution,
            name,
        } = this.typeDetails;
        cursor.save();
        cursor.fixed = fixed;
        this.shape.draw(cursor, true);
        cursor.save();
        if (this.typeDetails.hasGlow) {
            const color = glowColor.clone();
            color.A *= this.#state.distanceCoeff;
            cursor.filter = `blur(${glowResolution}px)`;
            cursor.strokeStyle = color.toRGBA();
            cursor.lineWidth = glowRadius;
            cursor.stroke();
            cursor.globalCompositeOperation = "destination-out";
            if (fillColor.opaque) cursor.filter = this.fillFilter;
            cursor.fillStyle = fillColor.toRGBA();
            cursor.fill();
            cursor.globalCompositeOperation = "source-over";
        } else {
            cursor.fillStyle = fillColor.toRGBA();
            cursor.fill();
        }
        cursor.restore();
        if (borderWidth) {
            const color = (glowColor.visible ? glowColor : borderColor).clone();
            color.A *= this.#state.distanceCoeff**(1/4);
            cursor.strokeStyle = borderColor.lerp(color, .65, false, false).toRGBA();
            cursor.lineWidth = borderWidth;
            cursor.stroke();
        }
        cursor.restore();
    }
    drawText (cursor, offset = undefined, fixed = false) {
        if (!this.hidden && !this.isTextOverflowing)
            super.drawText(cursor, offset, fixed);
    }
    // Vector, Vector, Number, Number
    // halfLayoutSpace should be totalLayoutSpace.div(2)
    // maxDistance is the factor by which distance coeff is applied. Does not actually clamp the distance
    // [!] stores reference
    setLayout (totalLayoutSpace, halfLayoutSpace, rowSkew, maxDistance) {
        this.#layout.totalSpace = totalLayoutSpace;
        this.#layout.halfSpace = halfLayoutSpace;
        this.#layout.rowSkew = rowSkew;
        this.#layout.maxDistance = maxDistance;
    }
    // wraps position
    updatePosition (centerPoint, focalPoint = undefined) {
        if (!this.isLayoutSet) return;
        const { shape } = this;
        const { SCALE_RATE } = this.constructor;
        const { totalSpace, halfSpace, rowSkew, maxDistance } = this.#layout;
        const relativeOffset = this.shape.center.sub(centerPoint);
        const wrapOffset = new Vector(0, 0);
        // wrap Y first, add skew to X if wrapped
        if (relativeOffset.y < -halfSpace.y) {
            const count = Math.ceil((Math.abs(relativeOffset.y) - halfSpace.y) / totalSpace.y);
            wrapOffset.y += totalSpace.y * count;
            wrapOffset.x += rowSkew * count;
        } else if (relativeOffset.y > halfSpace.y) {
            const count = Math.ceil((relativeOffset.y - halfSpace.y) / totalSpace.y);
            wrapOffset.y -= totalSpace.y * count;
            wrapOffset.x -= rowSkew * count;
        }
        if (wrapOffset.y !== 0 || wrapOffset.x !== 0) {
            shape.transform.offset.apply(wrapOffset);
            shape.applyTransform();
            relativeOffset.x = shape.center.x - screenCenter.x;
            wrapOffset.x = 0;
            wrapOffset.y = 0;
        }
        // X wrap after Y wrapping and skew is done
        if (relativeOffset.x < -halfSpace.x) {
            const count = Math.ceil((Math.abs(relativeOffset.x) - halfSpace.x) / totalSpace.x);
            wrapOffset.x += totalSpace.x * count;
        } else if (relativeOffset.x > halfSpace.x) {
            const count = Math.ceil((relativeOffset.x - halfSpace.x) / totalSpace.x);
            wrapOffset.x -= totalSpace.x * count;
        }
        if (wrapOffset.x !== 0) {
            shape.transform.offset.apply(wrapOffset);
            shape.applyTransform();
        }
        // compute distance
        const distance = shape.center.distance(focalPoint?.isVector ? focalPoint : centerPoint);
        const coeff = Number.isFinite(maxDistance)
            ? (maxDistance - distance) / maxDistance
            : distance;
        this.#state.distanceCoeff = coeff**AmmoTypeButton.SCALE_RATE;
    }
    // Vector, Number, ?Vector
    updateOffset (delta, centerPoint = undefined, focalPoint = undefined) {
        const { shape } = this;
        // restore original scale
        shape.transform.scale.apply(1 / (equals(this.#state.lastScale, 0)
            ? MIN_SCALE
            : this.#state.lastScale));
        shape.transform.offset.apply(delta);
        shape.applyTransform();
        if (centerPoint?.isVector && focalPoint?.isVector)
            this.updatePosition(centerPoint, focalPoint);
        const scale = this.#computeScale();
        shape.transform.scale.apply(scale);
        shape.applyTransform();
        this.#state.lastScale = scale;
        this.hidden = scale <= this.constructor.HIDE_SCALE;
    }

    get isAmmoTypeButton () { return true }
    get isTextOverflowing () { return (this.textSizing.width + this.textPadding.x) > this.width
        || (this.textSizing.height + this.textPadding.y) > this.height
    }
    get isLayoutSet () { return (
        this.#layout.totalSpace?.isVector
        && this.#layout.halfSpace?.isVector
        && Number.isFinite(this.#layout.rowSkew)
        && Number.isFinite(this.#layout.maxDistance))
    }
    get typeDetails () { return this.#typeDetails }
    set typeDetails (typeDetails) {
        if (!typeDetails?.isAmmoTypeDetails)
            throw new Error(`[${typeString(this)}]: Expected AmmoTypeDetails, got ${typeString(typeDetails)}`);
        super.text = typeDetails.name; // trigger recompute sizing
        return (this.#typeDetails = typeDetails);
    }
    get text () { return this.typeDetails?.name }
    set text (str) {} // [!] override to prevent dangling recompute triggers
    get fontFamily () { return this.typeDetails.fontFamily }
    get fontColor () { return this.typeDetails.fontColor }
    get fillColor () { return this.typeDetails.fillColor }
    get strokeColor () { return this.typeDetails.borderColor }
    get textPadding () { return this.#textPadding }
}