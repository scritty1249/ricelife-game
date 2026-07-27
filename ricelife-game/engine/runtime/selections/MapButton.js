import {
    ShapeButton,
    Color,
    Vector,
    Path,
    Equigon
} from "../../core/Core.js";

export class MapButton extends ShapeButton {
    static LERP_FACTOR = 0.175;
    static LERP_CLAMP_THRESHOLD = 0.1;
    static EXPAND_LENGTH_FACTOR = 1.2;
    static TILE_LEG_LENGTH = 150;
    #thumb;
    #src;
    #currentState = {
        textOffset: new Vector(),
    }
    #points = {
        anchor: new Path(),
        expand: new Path()
    };
    #lerpState = {
        isLerping: false,
        amount: 0, // flag for when all lerps are done
        open: false,
        active: false
    };
    #openState = {
        font: new Color(),
        fill: new Color(),
        stroke: new Color(),
        offset: new Vector(),
        anchor: new Path(),
        expand: new Path(),
    }
    #closeState = {
        font: new Color(),
        fill: new Color(),
        stroke: new Color(),
        offset: new Vector(),
        anchor: new Path(),
        expand: new Path(),
    }
    #activeState = {
        font: new Color(),
        fill: new Color(),
        stroke: new Color(),
        offset: new Vector(),
        anchor: new Path(),
        expand: new Path(),
    };
    #expandLength;
    constructor (name, src, thumbnail) {
        super(new Equigon(6, MapSelection.TILE_LEG_LENGTH));
        this.text = name;
        this.#src = src;
        this.#thumb = thumbnail;
        this.#init();
        this.save(); // make sure save is called at least once, even if wasteful
    }

    #init () {
        this.#expandLength = this.shape.length * this.constructor.EXPAND_LENGTH_FACTOR;

        // setting up stretchable equigon
        const { path } = this.shape.polygon;
        path.splice(0, 0, path.at(0).clone());
        path.splice(3 + 1, 0, path.at(3+1).clone());

        // pushes in by reference
        this.#points.expand.push(path.at(-3), path.at(-2), path.at(-1), path.at(0));
        this.#points.anchor.push(path.at(1), path.at(2), path.at(3), path.at(4));

        // setup thumbnail scaling and origin
        this.thumb.origin.apply(this.thumb.rawSize.div(2));
    }
    #lerpValues () {
        const lerpState = this.#lerpState;
        if (!lerpState.isLerping) return;
        const target = lerpState.active ? this.#activeState : (lerpState.open ? this.#openState : this.#closeState);
        const { LERP_FACTOR, LERP_CLAMP_THRESHOLD } = this.constructor;
        let isDone = true;
        if (target.font?.isColor) {
            this.fontColor.lerp(target.font, LERP_FACTOR, true, true);
            isDone = isDone && this.fontColor.distance(target.font) <= LERP_CLAMP_THRESHOLD;
        }
        if (target.fill?.isColor) {
            this.fillColor.lerp(target.fill, LERP_FACTOR, true, true);
            isDone = isDone && this.fillColor.distance(target.fill) <= LERP_CLAMP_THRESHOLD;
        }
        if (target.stroke?.isColor) {
            this.strokeColor.lerp(target.stroke, LERP_FACTOR, true, true);
            isDone = isDone && this.strokeColor.distance(target.stroke) <= LERP_CLAMP_THRESHOLD;
        }
        if (target.offset?.isVector) {
            this.#currentState.textOffset.lerp(target.offset, LERP_FACTOR, true);
            isDone = isDone && this.#currentState.textOffset.distance(target.offset) <= LERP_CLAMP_THRESHOLD;
        }
        if (target.anchor?.length)
            for (const [ start, end ] of zip([this.#points.anchor, target.anchor])) {
                start.lerp(end, LERP_FACTOR, true);
                isDone = isDone && start.distance(end) <= LERP_CLAMP_THRESHOLD;
            }
        if (target.expand?.length)
            for (const [ start, end ] of zip([this.#points.expand, target.expand])) {
                start.lerp(end, LERP_FACTOR, true);
                isDone = isDone && start.distance(end) <= LERP_CLAMP_THRESHOLD;
            }
        if (isDone) {
            lerpState.isLerping = false;
            lerpState.amount = 0;
        }
    }
    #drawThumbnail (cursor) {
        cursor.save();
        this.shape.draw(cursor, true);
        cursor.clip();
        const { x, y } = this.getPosition();
        this.thumb.draw(cursor, x, y, true);
        cursor.restore();
    }
    #drawGlow (cursor) {
        cursor.save();
        if (this.isActive) cursor.lineWidth = 8;
        else if (this.isOpen) cursor.lineWidth = 1;
        else cursor.lineWidth = 4;
        cursor.fillColor = "transparent";
        cursor.filter = "blur(10px)";
        cursor.strokeStyle = this.strokeColor.toString();
        this.shape.draw(cursor, true);
        cursor.stroke();
        cursor.fill();
        cursor.restore();
    }

    // call after applying transforms- before opening and closing.
    save () {
        if (this.#lerpState.isLerping) {
            console.warn(`[${this.constructor.name}]: Passing call, unable to save state during animation`);
            return;
        }
        if (this.thumb.width < this.thumb.height) {
            this.thumb.width = this.getBoundingBox().width;
        } else if (this.thumb.width > this.thumb.height) {
            this.thumb.height = this.getBoundingBox().height;
        }
        const open = this.#openState;
        const close = this.#closeState;
        const active = this.#activeState;
        const length = this.#expandLength / 2;
        open.anchor.apply(...this.anchor.map((pt) => pt.clone()));
        open.expand.apply(...this.expand.map((pt) => pt.clone()));
        close.anchor.apply(...this.anchor.map((pt) => pt.clone()));
        close.expand.apply(...this.expand.map((pt) => pt.clone()));
        active.anchor.apply(...this.anchor.map((pt) => pt.clone()));
        active.expand.apply(...this.expand.map((pt) => pt.clone()));
        if (this.isOpen) {
            close.anchor.forEach((pt) => pt.x += length);
            close.expand.forEach((pt) => pt.x -= length);
        } else {
            open.anchor.forEach((pt) => pt.x -= length);
            open.expand.forEach((pt) => pt.x += length);
            active.anchor.forEach((pt) => pt.x -= length);
            active.expand.forEach((pt) => pt.x += length);
        }
    }
    open () {
        this.#lerpState.active = false;
        if (this.isOpen) return;
        this.#lerpState.open = true;
        this.#lerpState.isLerping = true;
    }
    close () {
        this.#lerpState.active = false;
        if (!this.isOpen) return;
        this.#lerpState.open = false;
        this.#lerpState.isLerping = true;
    }
    active () {
        if (this.isActive) return;
        this.#lerpState.active = true;
        this.#lerpState.isLerping = true;
    }
    draw (cursor, fixed = false) {
        this.#lerpValues();
        super.draw(cursor, fixed);
    }
    drawText (cursor, offset = undefined, fixed = false) {
        const currentOffset = this.#currentState.textOffset;
        super.drawText(
            cursor,
            offset?.isVector
                ? offset.add(currentOffset)
                : currentOffset,
            fixed
        );
    }
    drawButton (cursor, fixed = false) {
        this.#drawGlow(cursor);
        this.#drawThumbnail(cursor);
        super.drawButton(cursor, fixed);
    }

    get isMapButton () { return true }
    get isAnimating () { return this.#lerpState.isLerping }
    get isOpen () { return this.#lerpState.open }
    get isActive () { return this.#lerpState.active }
    get anchor () { return this.#points.anchor }
    get expand () { return this.#points.expand }
    get thumb () { return this.#thumb }
    get src () { return this.#src }
    get maxWidth () { return this.#expandLength + this.shape.getBoundingBox().width }
    get openFontColor () { return this.#openState.font }
    get openFillColor () { return this.#openState.fill }
    get openStrokeColor () { return this.#openState.stroke }
    get openTextOffset () { return this.#openState.offset }
    get closeFontColor () { return this.#closeState.font }
    get closeFillColor () { return this.#closeState.fill }
    get closeStrokeColor () { return this.#closeState.stroke }
    get closeTextOffset () { return this.#closeState.offset }
    get activeFontColor () { return this.#activeState.font }
    get activeFillColor () { return this.#activeState.fill }
    get activeStrokeColor () { return this.#activeState.stroke }
    get activeTextOffset () { return this.#activeState.offset }
}
