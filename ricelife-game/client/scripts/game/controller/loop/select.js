import { PhaseController } from "./main.js";
import { InputListener } from "../player.js";
import { Color, Vector, Equigon } from "../../geometry/geometry.js";
import { drawCircle, clamp, floatEqual } from "../../utils/utils.js";
import * as Menu from "../../menu/menu.js"

export class SelectionController extends PhaseController {
    // bound to ShapeButton (Tile)
    static tileDrawFn (cursor) {
        const { userData } = this.shape.polygon;
        const { selection } = userData;
        const { fillColor, fontColor, borderColor, borderWidth, name } = selection;
        cursor.save();
        this.shape.draw(cursor, true);
        if (fillColor.visible) {
            cursor.save();
            cursor.fillStyle = fillColor.toRGBA();
            cursor.fill();
            cursor.restore();
        }
        if (selection.hasGlow) {
            const { glowColor, glowRadius, glowResolution } = selection;
            cursor.save();
            cursor.filter = `blur(${glowResolution}px)`;
            this.shape.draw(cursor, true);
            cursor.strokeStyle = glowColor.toString();
            cursor.lineWidth = glowRadius;
            cursor.stroke();
            cursor.globalCompositeOperation = "destination-out";
            cursor.fill();
            cursor.globalCompositeOperation = "source-over";
            cursor.restore();
        }
        if (borderColor.visible && borderWidth) {
            cursor.strokeStyle = borderColor.toRGBA();
            cursor.lineWidth = borderWidth;
            cursor.stroke();
        }
        const textOffset = selection.constructor.textOffsetScale.mul(this.shape.center).add(this.shape.center, true);
        this.drawText(cursor);
        cursor.restore();
    }
    static SETTINGS = {
        DEFAULT_INVERT_CONTROLS: true,
        // values for grow and shrink effects while traversing menu
        MIN_TILE_SCALE: 0.15,
        MAX_TILE_SCALE: 1.5,
        TILE_SCALE_RATE: 2, // [!] must be an Integer
        // limits for inital tile size relative to viewport dimensions
        MIN_TILE_SIZE: 100,
        MAX_TILE_SIZE: 300,
    };
    static backgroundFilter = "blur(20px) brightness(30%)";
    static minSelectionSize = 150;
    static maxSelectionSize = 300;
    #Interface;
    #ResizeObserver;
    constructor (mainController, shotSelections = []) {
        super(mainController);
        this.#init(shotSelections);
        this.#setupInterface();
        this.#computeTileLayout(5);
        this.#setupTiles();
        this.#resetTilePositions();
        this.#updateTiles();
        this.state = this.constructor.STATES.Ready;
    }
    #init (selections) {
        this.store.SELECTED = undefined;
        this.store.lastDrawnPosition = this.Global.Display.center.clone();
        this.store.lastActivePosition = this.store.lastDrawnPosition.clone();
        this.flags.trackActive = false;
        this.flags.exitable = false;
        this.flags.INVERT_TRACKING = this.constructor.SETTINGS.DEFAULT_INVERT_CONTROLS;
        this.store.selections = [];
        for (const selection of selections) {
            if (!selection?.isShotSelection) throw new Error(`[${this.constructor.name}]: Invalid type - expected ShotSelection, got ${typeof selection}`);
            this.store.selections.push(selection);
        }
        this.#Interface = new Menu.Interface();
    }
    #setupInterface () {
        const underButton = this.Global.Display.getBoundingBox().clone();
        underButton.isOver = underButton.isIntersecting;
        underButton.id = true;
        underButton.onrelease = (point, delta) => {
            if (this.flags.exitable && floatEqual(delta.length, 0))
                this.state = this.constructor.STATES.Raise;
        }
        this.Interface.insert().push(underButton);
        this.store.tileLayer = this.Interface.insert();
    }
    // padding in pixels
    #computeTileLayout (padding = 0) {
        // create template tile
        const { MIN_TILE_SIZE, MAX_TILE_SIZE } = this.constructor.SETTINGS;
        const legLength = clamp(this.Global.Display.size.max() / 2, MIN_TILE_SIZE, MAX_TILE_SIZE);
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
        userData.lastScale = 1;
        btn.onclick = () => {
            this.store.SELECTED = userData.selection.name;
            this.state = this.constructor.STATES.Raise;
        }
        // styling
        btn.text = selection.name;
        btn.fontColor.apply(selection.fontColor);
        btn.fillColor.apply(selection.fillColor);
        btn.strokeColor.apply(selection.borderColor);
        btn.draw = this.constructor.tileDrawFn.bind(btn);
        return btn;
    }
    #wrapTilePosition (tile) {
        const { tileTotalSpace, tileHalfSpace, tileRowSkew } = this.store;
        const screenCenter = this.Global.Display.center;
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
        const { lastDrawnPosition, lastActivePosition, tileSpace, tileRings, tileTotalSpace, tileHalfSpace, tileRowSkew } = this.store;
        const { MAX_TILE_SCALE, MIN_TILE_SCALE, TILE_SCALE_RATE } = this.constructor.SETTINGS;
        const screenCenter = this.Global.Display.center;
        const offset = this.flags.INVERT_TRACKING
            ? lastDrawnPosition.sub(lastActivePosition)
            : lastActivePosition.sub(lastDrawnPosition);
        for (const tile of items) {
            tile.shape.transformation.scale.apply(1 / tile.shape.polygon.userData.lastScale);            
            tile.shape.transformation.offset.apply(offset);
            tile.shape.applyTransformation();
            this.#wrapTilePosition(tile);
            const scale = clamp(
                ((this.Global.Display.size.min() - tile.shape.center.distance(screenCenter)) / this.Global.Display.size.min())
                    **TILE_SCALE_RATE,
                MIN_TILE_SCALE, MAX_TILE_SCALE
            );
            tile.shape.transformation.scale.apply(scale);
            tile.shape.applyTransformation();
            tile.shape.polygon.userData.lastScale = scale;
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

    start () {
        this.flags.exitable = false;
        if (this.Global.Input.pointer.isActive)
            this.Global.Input.pointer.onNextRelease()
                .then(() => this.flags.exitable = true);
        else this.flags.exitable = true;
    }
    reset () {
        this.state = this.constructor.STATES.Ready;
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
        if (!lastDrawnPosition.eq(lastActivePosition)) {
            this.#updateTiles();
            lastDrawnPosition.apply(lastActivePosition);
        }
        this.Interface.draw(cursor);
        cursor.restore();
    }
    async tick (delta) {
        this.#handleInput();
    }
    close () {
        this.state = this.constructor.STATES.Busy;
        super.close();
    }
    get isSelectionController () { return true }
    get Interface () { return this.#Interface }
    get ResizeObserver () { return this.#ResizeObserver }
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
    #borderColor = new Color(255, 240, 240);
    #fillColor = new Color(70, 70, 70);
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