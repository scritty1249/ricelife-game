import { PhaseController } from "./main.js";
import { InputListener } from "../player.js";
import { Color, Vector, Equigon } from "../../geometry/geometry.js";
import { drawCircle, clamp, floatEqual } from "../../utils/utils.js";
import * as Menu from "../../menu/menu.js"

export class SelectionController extends PhaseController {
    // bound to ShapeButton (Tile)
    // controller should be the containing SelectionController
    static tileDrawFn (controller, cursor) {
        const { TILE_MINIMIZE_SCALE } = controller.constructor.SETTINGS;
        const { TILE_HIDE_SCALE } = controller.constructor;
        const { userData } = this.shape.polygon;
        const { selection } = userData;
        const { fillColor, fontColor, borderColor, borderWidth, glowColor, glowRadius, glowResolution, name } = selection;
        const totalScale = this.shape.globalTransformation.scale;
        const textOffset = selection.constructor.textOffsetScale.mul(this.shape.center).add(this.shape.center, true);
        const hideText = totalScale.lengthSquared < TILE_MINIMIZE_SCALE;
        if (totalScale.x <= TILE_HIDE_SCALE || totalScale.y <= TILE_HIDE_SCALE) return;
        cursor.save();
        cursor.fixed = true;
        this.shape.draw(cursor, true);
        if (!selection.hasGlow ) {
            cursor.save();
            cursor.fillStyle = fillColor.toRGBA();
            cursor.fill();
            cursor.restore();
        }
        if (selection.hasGlow) {
            // border glow
            const color = glowColor.clone();
            color.A *= userData.distanceCoeff;
            cursor.save();
            cursor.filter = `blur(${glowResolution}px)`;
            this.shape.draw(cursor, true);
            cursor.strokeStyle = color.toRGBA();
            cursor.lineWidth = glowRadius;
            cursor.stroke();
            cursor.globalCompositeOperation = "destination-out";
            cursor.filter = SelectionController.tileFillFilter;
            cursor.fillStyle = fillColor.toRGBA();
            cursor.fill();
            cursor.globalCompositeOperation = "source-over";
            cursor.restore();            
        }
        if (borderWidth) {
            const color = (glowColor.visible ? glowColor : borderColor).clone();
            color.A *= userData.distanceCoeff**(1/4);
            cursor.strokeStyle = borderColor.lerp(color, .65, false, false).toRGBA();
            cursor.lineWidth = borderWidth;
            cursor.stroke();
        }
        if (!hideText) {
            this.drawText(cursor, undefined, true);
        }
        cursor.restore();
    }
    static SETTINGS = {
        DEFAULT_INVERT_CONTROLS: true,
        FOCAL_LERP_FACTOR: 0.15, // speed that focal point moves from different points onscreen
        FOCAL_SNAP_THRESHOLD: 10**2, // (squared) distance in pixels that focal point will snap to target position
        // values for grow and shrink effects while traversing menu
        MIN_TILE_SCALE: 0.0,
        MAX_TILE_SCALE: 1.5,
        TILE_SCALE_RATE: 3, // [!] must be an Integer
        TILE_MINIMIZE_SCALE: 0.5**2, // (squared) threshold below which tile details will be hidden, and become unclickable
        // limits for inital tile size relative to viewport dimensions
        MIN_TILE_SIZE: 75,
        MAX_TILE_SIZE: 300,
    };
    static TILE_HIDE_SCALE = 0.0001; // scale to treat as zero, or hidden. Acts as a sentinal value
    static tileFillFilter = "blur(10px)"; // [!] setting this over 30px causes massive framerate drop
    static backgroundFilter = "blur(20px) brightness(30%)";
    static minSelectionSize = 150;
    static maxSelectionSize = 300;
    static tileSpacingScale = -.1;
    #Interface;
    #ResizeObserver;
    #loadPromise;
    #tileFontFamily;
    constructor (mainController, shotSelections = []) {
        super(mainController);
        this.#init(shotSelections);
        this.#loadPromise = this.#load()
            .then(() => this.#setupInterface())
            .then(() => this.#computeTileLayout())
            .then(() => this.Global.Display.addResizeListener(this.#onResize))
            .then(() => this.#setupTiles())
            .then(() => this.#resetTilePositions())
            .then(() => this.#updateTiles())
            .then(() => this.state = this.constructor.STATES.Ready)
            .then(() => this);
    }
    #init (selections) {
        this.store.SELECTED = undefined;
        this.store.lastDrawnPosition = this.Global.Display.center.clone();
        this.store.lastActivePosition = this.store.lastDrawnPosition.clone();
        this.store.focalPoint = this.Global.Display.center.clone(); // lerp-able focal point
        this.flags.focalPointer = false; // focal point is following cursor or screen center
        this.flags.stickPointer = false; // once focal point lerps to pointer, stop lerping and stick to pointer
        this.flags.focalPointUpdated = false;
        this.flags.trackActive = false;
        this.flags.exitable = false;
        this.flags.INVERT_TRACKING = this.constructor.SETTINGS.DEFAULT_INVERT_CONTROLS;
        this.store.selections = [];
        for (const selection of selections) {
            if (!selection?.isShotSelection) throw new Error(`[${this.constructor.name}]: Invalid type - expected ShotSelection, got ${typeof selection}`);
            this.store.selections.push(selection);
        }
        this.#Interface = new Menu.Interface();
        this.Audio.Layer.tile = this.Audio.Player.Layer();
        this.Audio.Layer.tile.volume = .25;
        this.Audio.Layer.selected = this.Audio.Player.Layer();
        this.Audio.Layer.selected.volume = .4;
        this.Audio.Player.volume = .5;
        this.#tileFontFamily = this.Global.store.DEFAULT_FONT.family;
    }
    #load () {
        for (const assetKey of ["tilePing", "tileSelect"]) {
            this.loadAsset(assetKey, ...this.Global.AssetTable[assetKey]);
        }
        return this.AssetPool.onload;
    }
    #setupInterface () {
        const underButton = this.Global.Display.getBoundingBox().clone();
        underButton.isOver = underButton.isIntersecting;
        underButton.id = true;
        underButton.onclick = (point) => {
            if (this.flags.exitable)
                this.state = this.constructor.STATES.Raise;
        }
        this.Interface.insert().push(underButton).fixed = true;
        this.store.tileLayer = this.Interface.insert();
        this.store.tileLayer.fixed = true;
    }
    #onResize = () => {
        this.state = this.constructor.STATES.Busy;
        this.#computeTileLayout();
        this.#resetTilePositions();
        this.#updateTiles();
        this.state = this.constructor.STATES.Ready;
    }
    // padding in pixels
    #computeTileLayout () {
        // create template tile
        const { MIN_TILE_SIZE, MAX_TILE_SIZE } = this.constructor.SETTINGS;
        const { tileSpacingScale } = this.constructor;
        const tileWidth = clamp(this.Global.Display.size.x / 2, MIN_TILE_SIZE, MAX_TILE_SIZE);
        const legLength = tileWidth / Math.sqrt(3);
        const padding = tileWidth * tileSpacingScale;
        const shape = new Equigon(6, legLength);
        shape.transformation.scale.y = 0.85;
        shape.applyTransformation();
        this.store.selectionShape = shape;
        // compute data for tile positioning and scaling
        let layers = 1;
        while (3 * layers * layers - 3 * layers + 1 < this.store.selections.length) layers++;
        this.store.tileRings = Math.max(5, --layers);
        this.store.tileCount = Math.max(37, (3 * layers)**2 - (3 * layers) + 1);
        this.store.tileSize = shape.globalTransformation.scale.clone();
        this.store.tileSize.x *= Math.sqrt(3) * shape.length;
        this.store.tileSize.y *= 1.5 * shape.length;
        this.store.tileSpace = this.store.tileSize.clone(); // padded size
        this.store.tileSpace.x += padding;
        this.store.tileSpace.y += (padding * 1.5 / Math.sqrt(3));
        this.store.tileTotalSpace = this.store.tileSpace.mul(this.store.tileRings * 2 - 1);
        this.store.tileHalfSpace = this.store.tileTotalSpace.div(2);
        this.store.tileRowSkew = this.store.tileRings * (this.store.tileSpace.x / 2);
    }
    #setupTiles () {
        const { selections, tileLayer, tileCount, selectionShape } = this.store;
        for (let i = 0; i < tileCount; i++) {
            tileLayer.push(
                this.#setupTile(selectionShape.clone(true), this.store.selections[i % this.store.selections.length])
            )
        }
    }
    #resetTilePositions () {
        const { tileSpace, tileCount, tileLayer } = this.store;
        const { center } = this.Global.Display;
        const tiles = tileLayer.items;
        const coords = [];
        for (let q = -tileCount; q <= tileCount; q++) {
            const rMin = Math.max(-tileCount, -q - tileCount);
            const rMax = Math.min(tileCount, -q + tileCount);
            for (let r = rMin; r <= rMax; r++) {
                const s = -q - r;
                const distance = Math.max(Math.abs(q), Math.abs(r), Math.abs(s));
                coords.push({ q, r, distance });
            }
        }
        // sort to arrange shapes to sprial from inside-out
        coords.sort((a, b) => {
            if (a.distance !== b.distance) return a.distance - b.distance;
            return a.q - b.q || a.r - b.r;
        });
        for (let i = 0; i < tileCount && tiles.length; i++) {
            const { q, r } = coords[i];
            const shape = tiles[i].shape;
            shape.moveTo(center);
            shape.transformation.offset.apply(tileSpace.x * (q + r / 2), tileSpace.y * r);
            shape.applyTransformation();
        }
    }
    #setupTile (shape, selection) {
        const btn = new Menu.ShapeButton(shape, new Color(255, 0, 0));
        const { userData } = shape.polygon;
        userData.selection = selection;
        userData.distanceCoeff = 0;
        userData.lastScale = 1;
        btn.onclick = (point, delta) => {
            if (btn.shape.globalTransformation.scale.lengthSquared < this.constructor.SETTINGS.TILE_MINIMIZE_SCALE) {
                return;
            }
            this.store.SELECTED = userData.selection.name;
            this.state = this.constructor.STATES.Raise;
            this.Audio.Layer.tile.stop();
            this.Audio.Layer.selected.add(this.AssetPool.get("tileSelect").Instance().play(), true);
        }
        // styling
        btn.text = selection.name;
        btn.fontFamily = selection.fontFamily;
        btn.fontColor.apply(selection.fontColor);
        btn.fillColor.apply(selection.fillColor);
        btn.strokeColor.apply(selection.borderColor);
        btn.draw = this.constructor.tileDrawFn.bind(btn, this);
        return btn;
    }
    #wrapTilePosition (tile, screenCenter) {
        const { tileTotalSpace, tileHalfSpace, tileRowSkew } = this.store;
        const relativeOffset = tile.shape.center.sub(screenCenter);
        const wrapOffset = new Vector(0, 0);
        // wrap Y first, add skew to X if wrapped
        if (relativeOffset.y < -tileHalfSpace.y) {
            const count = Math.ceil((Math.abs(relativeOffset.y) - tileHalfSpace.y) / tileTotalSpace.y);
            wrapOffset.y += tileTotalSpace.y * count;
            wrapOffset.x += tileRowSkew * count;
        } else if (relativeOffset.y > tileHalfSpace.y) {
            const count = Math.ceil((relativeOffset.y - tileHalfSpace.y) / tileTotalSpace.y);
            wrapOffset.y -= tileTotalSpace.y * count;
            wrapOffset.x -= tileRowSkew * count;
        }
        if (wrapOffset.y !== 0 || wrapOffset.x !== 0) {
            tile.shape.transformation.offset.apply(wrapOffset);
            tile.shape.applyTransformation();
            relativeOffset.x = tile.shape.center.x - screenCenter.x;
            wrapOffset.x = 0;
            wrapOffset.y = 0;
        }

        // X wrap after Y wrapping and skew is done
        if (relativeOffset.x < -tileHalfSpace.x) {
            const count = Math.ceil((Math.abs(relativeOffset.x) - tileHalfSpace.x) / tileTotalSpace.x);
            wrapOffset.x += tileTotalSpace.x * count;
        } else if (relativeOffset.x > tileHalfSpace.x) {
            const count = Math.ceil((relativeOffset.x - tileHalfSpace.x) / tileTotalSpace.x);
            wrapOffset.x -= tileTotalSpace.x * count;
        }
        if (wrapOffset.x !== 0) {
            tile.shape.transformation.offset.apply(wrapOffset);
            tile.shape.applyTransformation();
        }
    }
    #updateTiles () {
        const items = this.store.tileLayer.items;
        if (items.length === 0) return;
        const { lastDrawnPosition, lastActivePosition, tileSpace, tileRings, tileTotalSpace, tileHalfSpace, tileRowSkew, selectionShape, focalPoint } = this.store;
        const { MAX_TILE_SCALE, MIN_TILE_SCALE, TILE_SCALE_RATE } = this.constructor.SETTINGS;
        const { TILE_HIDE_SCALE } = this.constructor;
        const sizeSfxThreshold = selectionShape.getBoundingBox().extent * .8;
        const screenCenter = this.Global.Display.center;
        const screenBbox = this.Global.Display.getBoundingBox();
        const offset = this.flags.INVERT_TRACKING
            ? lastDrawnPosition.sub(lastActivePosition)
            : lastActivePosition.sub(lastDrawnPosition);
        for (const tile of items) {
            const lastSize = tile.shape.getBoundingBox().extent;
            const { lastScale } = tile.shape.polygon.userData;
            tile.shape.transformation.scale.apply(1 / (floatEqual(lastScale, 0) ? TILE_HIDE_SCALE : lastScale));          
            tile.shape.transformation.offset.apply(offset);
            tile.shape.applyTransformation();
            this.#wrapTilePosition(tile, screenCenter);
            tile.shape.polygon.userData.distanceCoeff = ((this.Global.Display.size.min() - tile.shape.center.distance(focalPoint)) / this.Global.Display.size.min())
                    **TILE_SCALE_RATE;
            const scale = clamp(tile.shape.polygon.userData.distanceCoeff,
                MIN_TILE_SCALE, MAX_TILE_SCALE
            );
            const newScale = floatEqual(scale, 0) ? TILE_HIDE_SCALE : scale;
            tile.shape.transformation.scale.apply(newScale);
            tile.shape.applyTransformation();
            tile.shape.polygon.userData.lastScale = newScale;
            // sfx
            const newSize = tile.shape.getBoundingBox().extent;
            if (newSize >= sizeSfxThreshold
                && lastSize < sizeSfxThreshold
                && screenBbox.isIntersecting(tile.shape.center)
                && !this.Audio.Layer.selected.playing
                && this.state === this.constructor.STATES.Ready
            ) {
                this.Audio.Layer.tile.add(this.AssetPool.get("tilePing").Instance().play(), true);
            }
            
        }
    }
    #handleInput () {
        const { lastDrawnPosition, lastActivePosition } = this.store;
        const { pointer } = this.Global.Input;
        if (pointer.isActive) {
            if (this.flags.trackActive) {
                lastActivePosition.apply(pointer.position);
                return;
            } else {
                this.flags.trackActive = true;
                lastDrawnPosition.apply(lastActivePosition.apply(pointer.position));
            }
        } else this.flags.trackActive = false;
    }
    // set tile scaling focal point to pointer position
    #followPointer () {
        this.flags.stickPointer = this.flags.focalPointer && this.flags.stickPointer;
        this.flags.focalPointer = true;
    }
    // set tile scaling focal point to screen center
    #followCenter () {
        this.flags.stickPointer = !this.flags.focalPointer && this.flags.stickPointer;
        this.flags.focalPointer = false;
    }
    #updateFocalPoint () {
        const { FOCAL_LERP_FACTOR, FOCAL_SNAP_THRESHOLD } = this.constructor.SETTINGS;
        const { focalPoint } = this.store;
        const targetPosition = this.flags.focalPointer
            ? this.Global.Input.pointer.position
            : this.Global.Display.center;
        const oldPoint = focalPoint.clone();
        if (this.flags.stickPointer) {
            focalPoint.apply(targetPosition);
        } else {
            focalPoint.lerp(targetPosition, FOCAL_LERP_FACTOR, true);
            this.flags.stickPointer = this.flags.stickPointer
                || targetPosition.sub(focalPoint).dot() < FOCAL_SNAP_THRESHOLD;
        }
        this.flags.focalPointUpdated = !oldPoint.eq(focalPoint)
            || (!this.flags.focalPointer && this.Global.Input.pointer.delta.lengthSquared);
    }

    start () {
        this.state = this.constructor.STATES.Ready;
        this.Audio.Player.stop();
        this.flags.exitable = false;
        if (this.Global.Input.pointer.isActive)
            this.Global.Input.pointer.onNextRelease()
                .then(() => this.flags.exitable = true);
        else this.flags.exitable = true;
    }
    reset () {
        this.state = this.constructor.STATES.Busy;
        this.store.SELECTED = undefined;
        this.trackActive = false;
        this.store.lastDrawnPosition.apply(this.Global.Display.center);
        this.store.lastActivePosition.apply(this.store.lastDrawnPosition);
        this.#resetTilePositions();
        this.#updateTiles();
    }
    animate (clear = true) {
        const { cursor } = this.Global.Display;
        const { lastDrawnPosition, lastActivePosition } = this.store;
        cursor.save();
        if (clear) cursor.clear();
        if (this.flags.focalPointUpdated) this.#updateTiles();
        if (!lastDrawnPosition.eq(lastActivePosition)) {
            lastDrawnPosition.apply(lastActivePosition);
        }
        this.Interface.draw(cursor);
        cursor.restore();
    }
    async tick (delta) {
        this.#handleInput();
        if (this.Global.Input.pointer.isHovering) this.#followPointer();
        else this.#followCenter();
        this.#updateFocalPoint();
    }
    close () {
        this.state = this.constructor.STATES.Busy;
        this.Global.Display.removeResizeListener(this.#onResize);
        super.close();
    }
    get isSelectionController () { return true }
    get Interface () { return this.#Interface }
    get ResizeObserver () { return this.#ResizeObserver }
    get onload () { return this.#loadPromise }
}

export class ShotSelection {
    static textOffsetScale = new Vector(0, -.3);
    name;
    fontSize = 24;
    fontFamily = "serif";
    borderWidth = 5;
    glowRadius = 25;
    glowResolution = 10;
    #icon;
    #glowColor = new Color(0, 0, 0, 0);
    #borderColor = new Color(255, 255, 255);
    #fillColor = new Color(70, 70, 70, .8);
    #fontColor = new Color(255, 255, 255);

    constructor (name, icon) {
        this.name = name;
        this.#icon = icon;
    }

    get isShotSelection () { return true }
    get hasGlow () { return this.glowColor.visible && this.glowRadius && this.glowResolution }
    get icon () { return this.#icon }
    get fontColor () { return this.#fontColor }
    get glowColor () { return this.#glowColor }
    get borderColor () { return this.#borderColor }
    get fillColor () { return this.#fillColor }
    get fontStyle () { return `${this.fontSize}px ${this.fontFamily}` }
}