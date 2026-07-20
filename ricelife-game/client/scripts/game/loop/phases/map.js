import { Phase } from "./phase.js";
import { Equigon, Color, Vector, Path, BoundingBox } from "../../geometry/geometry.js";
import { ShapeButton } from "../../menu/menu.js";
import { ViewboxController } from "../../controller/controller.js";
import { uuid, zip } from "../../utils/utils.js";

export class MapPhase extends Phase {
    static SETTINGS = {
        DEFAULT_INVERT_CONTROLS: true,
        SCROLL_SENSITIVITY: 1/3 
    };
    static tileSpacingScale = .1;
    #Camera;
    constructor (mainController, mapSelections = []) {
        super(mainController);
        this.#init();
        this.#load(mapSelections)
            .then(() => this.#attachListeners())
            .then(() => this.#onResize())
            .then(() => this.start());
    }

    #init () {
        this.flags.INVERT_TRACKING = this.constructor.SETTINGS.DEFAULT_INVERT_CONTROLS;
        this.#setupInterface();
    }
    async #load (selections) {
        // load map thumbnail images
        const { AssetType } = this.Global.constructor;
        const thumbnailPromises = Promise.all(selections.map(({name, thumb}) =>
            this.loadAsset(name, AssetType.Image, undefined, [thumb])));
        await thumbnailPromises;
        // setup map selection tile positions, and record for plane size
        const padScale = this.constructor.tileSpacingScale;
        let tileSize;
        let padX;
        let padY;
        let i = 0;
        for (const selection of selections) {
            const mapSelection = this.#createSelection(selection);
            const tileBbox = mapSelection.shape.getBoundingBox();
            const tileHeight = tileBbox.height;
            const tileWidth = mapSelection.maxWidth;
            if (!tileSize) {
                tileSize = tileBbox.size;
                tileSize.x = tileWidth;
                padX = tileBbox.width * padScale;
                padY = tileSize.y * padScale;
            }
            const offsetX = (tileWidth / 2) + padX;
            const offsetY = (tileHeight / 2) + padY;
            mapSelection.setPosition(offsetX, offsetY + (i * (tileSize.y + padY)));
            mapSelection.save();
            this.store.selectionLayer.push(mapSelection);
            i++;
        }
        // setup camera and viewbox
        this.Plane.max.apply(
            tileSize.x + (padX * 2),
            ((tileSize.y + padY) * selections.length) + padY
        );
        const planeSize = this.Plane.size;
        this.store.viewSize = new Vector(planeSize.x, tileSize.y + (padY * 2));
        this.#Camera = new ViewboxController(this.Global.Display, planeSize, this.store.viewSize);
        this.Interface.Viewbox = this.Camera.Viewbox;
        this.Global.Display.cursor.planeSize.apply(planeSize);
        this.Camera.setTargetSize(this.store.viewSize.x, this.store.viewSize.y, true);
        this.Camera.scalingBehavior = this.Camera.constructor.SCALING_BEHAVIOR.Always;
        this.Camera.setPosition(undefined, planeSize.y - (tileSize.y / 2) - padY);
    }
    #setupInterface () {
        const overButton = new BoundingBox();
        overButton.isOver = overButton.isIntersecting;
        overButton.id = uuid();
        overButton.onscroll = (point, delta) => {
            this.#scroll(delta);
        }
        overButton.ondrag = (point, origin, delta) => {
            this.#scroll(delta.div(this.constructor.SETTINGS.SCROLL_SENSITIVITY));
        }
        const underButton = new BoundingBox();
        underButton.isOver = underButton.isIntersecting;
        underButton.id = uuid();
        underButton.onclick = () => {
            for (const tile of this.store.selectionLayer.items) tile.close();
        }
        this.Interface.insert().push(underButton).fixed = true;
        this.store.selectionLayer = this.Interface.insert();
        this.store.selectionLayer.fixed = false;
        this.Interface.insert().push(overButton).fixed = true;
        this.store.screenButtons = {
            under: underButton,
            over: overButton
        };
    }
    #createSelection (selectionData) {
        const { name, src } = selectionData;
        const thumbnail = this.AssetPool.get(name).clone(false);
        const selection = new MapSelection(name, src, thumbnail);
        const bbox = selection.shape.getBoundingBox();
        const {
            fontColor, fillColor, strokeColor,
            openFontColor, openFillColor, openStrokeColor, openTextOffset,
            closeFontColor, closeFillColor, closeStrokeColor, closeTextOffset
        } = selection;

        selection.thumb.width = selection.maxWidth;

        selection.fontSize = 24;
        closeFontColor.apply(fontColor.apply(255, 255, 255, 1));
        closeFillColor.apply(fillColor.apply(0, 0, 0, 0.7));
        closeStrokeColor.apply(strokeColor.apply(255, 255, 255, 1));
        openFontColor.apply(closeFontColor);
        openFontColor.a = 0.25;
        openFillColor.apply(closeFillColor);
        openFillColor.a = 0.2;
        openStrokeColor.apply(closeStrokeColor);
        openTextOffset.apply(0, -(1.2/3) * bbox.height);

        // adding listeners
        selection.onclick = () => {
            if (selection.isOpen) {
                this.#selectMap(selection);
            } else {
                selection.open();
            }
        }
        return selection;
    }
    #selectMap (selection) {
        this.state = this.constructor.STATES.Raise;
        this.store.EXPORT = selection.src;
        this.Events.raiseEvent("EXIT", {selection});
    }
    #onResize = () => {
        const { under, over } = this.store.screenButtons;
        under.apply(over.apply(this.Global.Display.getBoundingBox()));
        this.Camera.update(); // [!] hacky solution
    }
    #attachListeners () {
        this.Global.Display.addResizeListener(this.#onResize);
    }
    #detatchListeners () {
        this.Global.Display.removeResizeListener(this.#onResize);
    }
    #scroll (delta) {
        const { SCROLL_SENSITIVITY } = this.constructor.SETTINGS;
        const sensitivity = SCROLL_SENSITIVITY / this.Camera.Viewbox.canvasScale.y;
        const scroll = delta.mul(this.flags.INVERT_TRACKING ? -sensitivity : sensitivity);
        this.Camera.offsetPosition(scroll);
    }

    animate (clear = true) {
        const { cursor } = this.Global.Display;
        if (clear) cursor.clear();
        
        this.Interface.draw(cursor);
    }
    reset () {
        super.reset();
        this.store.EXPORT = null;
        this.store.selectionLayer.items.forEach((item) => item.close());
    }

    get isMapPhase () { return true }
    get Camera () { return this.#Camera }
}

export class MapSelection extends ShapeButton {
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
        open: false
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

        this.thumb.origin.apply(this.thumb.rawSize.div(2));
    }
    #lerpValues () {
        const lerpState = this.#lerpState;
        if (!lerpState.isLerping) return;
        const target = lerpState.open ? this.#openState : this.#closeState;
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
        cursor.filter = "blur(10px)";
        cursor.strokeStyle = this.strokeColor.toString();
        this.shape.draw(cursor, true);
        cursor.stroke();
        cursor.restore();
    }

    // call after applying transforms- before opening and closing.
    save () {
        if (this.#lerpState.isLerping) {
            console.warn(`[${this.constructor.name}]: Passing call, unable to save state during animation`);
            return;
        }
        const open = this.#openState;
        const close = this.#closeState;
        const length = this.#expandLength / 2;
        open.anchor.apply(...this.anchor.map((pt) => pt.clone()));
        open.expand.apply(...this.expand.map((pt) => pt.clone()));
        close.anchor.apply(...this.anchor.map((pt) => pt.clone()));
        close.expand.apply(...this.expand.map((pt) => pt.clone()));
        if (this.isOpen) {
            close.anchor.forEach((pt) => pt.x += length);
            close.expand.forEach((pt) => pt.x -= length);
        } else {
            open.anchor.forEach((pt) => pt.x -= length);
            open.expand.forEach((pt) => pt.x += length);
        }
    }
    open () {
        if (this.isOpen) return;
        this.#lerpState.open = true;
        this.#lerpState.isLerping = true;
    }
    close () {
        if (!this.isOpen) return;
        this.#lerpState.open = false;
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

    get isMapSelection () { return true }
    get isAnimating () { return this.#lerpState.isLerping }
    get isOpen () { return this.#lerpState.open }
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
}