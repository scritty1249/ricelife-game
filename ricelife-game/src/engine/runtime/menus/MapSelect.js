import { Menu, ScreenButton, Vector } from "../../core/Core.js";
import { MapButton } from "../selections/MapButton.js";

const SCROLL_SENSITIVITY = 1/3; // [!] temporary

// [!] snatches control of parent phase's camera
export class MapSelect extends Menu {
    constructor (phase, maps) {
        super (phase);
        this.#init(maps);
        this.#load()
            .then(() => this.resolveLoad())
            .catch((error) => this.rejectLoad(error));
    }

    #init (maps) {
        this.store.maps = maps; // [!] currently stores raw object from internet. Need to parse into a dedicated class! -KT
        this.flags.OVERRIDE_PANNING = false; // use when map is selected (not just opened)
        this.flags.CAMERA_PANNING = false; // moving camera without user input

        this.InterfaceLayers.buttons = this.Interface.insert();
        this.InterfaceLayers.buttons.fixed = false;
        this.store.overButton = new ScreenButton(this.Parent.Global.Display);
        this.InterfaceLayers.over = this.Interface.insert();
        this.InterfaceLayers.over.push(this.store.overButton);
        this.InterfaceLayers.over.fixed = true;

        this.#setupPanningButtons();
    }
    async #load () {
        await this.#loadMapThumbnails();
        this.#setupMapButtons();
    }
    async #loadMapThumbnails () {
        const { AssetType } = this.Parent.Global.constructor;
        const { maps } = this.store;
        await Promise.all(maps.map(({name, thumb}) =>
            this.AssetPool.add(name, [AssetType.Image, undefined, thumb])));
    }
    #setupPanningButtons () {
        const { overButton, underButton } = this.store;
        overButton.onscroll = (point, delta) => {
            if (this.flags.OVERRIDE_PANNING) return;
            this.flags.CAMERA_PANNING = false;
            this.#scroll(delta.y);
        }
        overButton.ondrag = (point, origin, delta) => {
            if (this.flags.OVERRIDE_PANNING) return;
            this.flags.CAMERA_PANNING = false;
            this.#scroll(delta.y / SCROLL_SENSITIVITY);
        }
        underButton.onclick = () => {
            if (this.flags.OVERRIDE_PANNING) return;
            this.flags.CAMERA_PANNING = false;
            for (const button of this.InterfaceLayers.buttons.items) button.close();
        }
    }
    #setupMapButtons (spacingScale = 0.1) {
        const size = this.Area.max;
        const { maps } = this.store;
        let padX;
        let padY;
        for (let i = 0; i < maps.length; i++) {
            const mapButton = this.#createSelection(maps[i]);
            const tileBbox = mapButton.shape.getBoundingBox();
            const tileHeight = tileBbox.height;
            const tileWidth = mapButton.maxWidth;
            padX = tileBbox.width * spacingScale;
            padY = tileBbox.height * spacingScale;

            if (size.y <= 0) {
                this.store.tileSize = new Vector(tileWidth, tileHeight);
                this.store.tilePad = new Vector(padX, padY);
            }
            if (tileWidth > size.x)
                size.x = tileWidth + padX + padX;

            const offsetX = (tileWidth / 2) + padX;
            const offsetY = (tileHeight / 2) + size.y;
            mapButton.setPosition(offsetX, offsetY);
            mapButton.userData = { position: mapButton.getPosition() };
            mapButton.save();
            this.InterfaceLayers.buttons.push(mapButton);
            size.y += tileHeight;
            if (i < maps.length - 1)
                size.y += padY;
        }
        this.store.areaSize = this.Area.size;
        this.store.targetSize = this.store.tilePad.mul(2).add(this.store.tileSize, true);
    }
    #createSelection (selectionData) {
        const { name } = selectionData;
        const thumbnail = this.AssetPool.get(name).clone(false);
        const selection = new MapButton(name, thumbnail);
        const bbox = selection.shape.getBoundingBox();
        const {
            fontColor, fillColor, strokeColor,
            openFontColor, openFillColor, openStrokeColor, openTextOffset,
            closeFontColor, closeFillColor, closeStrokeColor, closeTextOffset,
            activeFontColor, activeFillColor, activeStrokeColor, activeTextOffset
        } = selection;

        selection.thumb.width = selection.maxWidth;

        selection.fontSize = 24;
        activeFontColor.apply(closeFontColor.apply(fontColor.apply(255, 255, 255, 1)));
        closeFillColor.apply(fillColor.apply(0, 0, 0, 0.7));
        closeStrokeColor.apply(strokeColor.apply(255, 255, 255, 1));
        openFontColor.apply(closeFontColor);
        openFontColor.a = 0.25;
        openFillColor.apply(closeFillColor);
        openFillColor.a = 0.2;
        openStrokeColor.apply(closeStrokeColor);
        openTextOffset.apply(0, -(1.2/3) * bbox.height);
        activeFontColor.apply(activeStrokeColor.apply(255, 0, 0, 1));
        activeFillColor.apply(openFillColor);
        activeFillColor.a = 0.4;

        // adding listeners
        selection.onclick = () => {
            if (this.flags.OVERRIDE_PANNING) return;
            const { Camera } = this.Parent;
            if (selection.isOpen) {
                selection.active();
                this.flags.OVERRIDE_PANNING = true;
                Camera.untrackAll();
                this.closeAllButtons();
                Camera.lerpFactor = 0.2;
                Camera.track(selection.getPosition());
                const size = Camera.getTargetSize();
                Camera.setTargetSize(size.x / 2, size.y / 2, true);
                this.Events.raiseEvent("SELECTED", selectionData);
            } else if (!selection.isActive) {
                Camera.untrackAll();
                selection.open();
                this.flags.CAMERA_PANNING = true;
                Camera.track(selection.getPosition());
            }
        }
        return selection;
    }
    #scroll (deltaY) {
        const sensitivity = SCROLL_SENSITIVITY / this.Parent.Camera.Viewbox.canvasScale.y;
        const scroll = deltaY * (this.flags.INVERT_TRACKING ? -sensitivity : sensitivity);
        this.Parent.Camera.offsetPosition(undefined, scroll);
    }
    #getTileScale () {
        return this.Parent.Global.Display.size.x / this.store.tileSize.x;
    }
    #setSpacing () {
        const { Display } = this.Parent.Global;
        const scale = this.#getTileScale();
        const paddingY = Math.max(
            this.store.tilePad.y * scale,
            Display.size.y - (this.store.tileSize.y * scale)
        ) / 2;
        for (const btn of this.InterfaceLayers.buttons.items) {
            const { position } = btn.userData;
            btn.setPosition(position.x, position.y + paddingY);
            btn.save();
        }
        this.Area.max.y = this.store.areaSize.y + paddingY + paddingY;
        this.Parent.Camera.Viewbox.setPlane(this.Area);
    }
    #setViewboxSize () {
        const { targetSize } = this.store;
        this.Parent.Camera.setTargetSize(targetSize.x, targetSize.y, true);
    }
    #setCameraTop () {
        const mapCount = this.InterfaceLayers.buttons.size || 1;
        const heightSpacing = this.Area.height / mapCount;
        const offsetY = heightSpacing * ((mapCount - 1) || 1);
        const top = offsetY + (heightSpacing / 2);
        this.Parent.Camera.setPosition(this.Area.width / 2, top);
    }

    onResize () {
        if (!super.onResize()) return false;
        // adjust Area padding on top and bottom so buttons fit evenly in center of viewbox
        this.#setSpacing();
        // set new target size
        this.#setViewboxSize();
        // don't transition
        this.Parent.Camera.jump();
        return true;
    }
    closeAllButtons (closeActive = false) {
        for (const button of this.InterfaceLayers.buttons.items)
            if (closeActive || !button.isActive) button.close();
    }
    // set Camera size and pan to top
    open () {
        if (!super.open()) return false;
        const { Camera } = this.Parent;
        this.#setSpacing();
        this.#setViewboxSize();
        this.#setCameraTop();
        Camera.jump();
        Camera.scalingBehavior = Camera.constructor.SCALING_BEHAVIOR.Always;
        Camera.lerpFactor = 0.1;
        return true;
    }
    close (returnData = undefined, haltAudio = true) {
        if (!super.close(returnData, haltAudio)) return false;
        this.closeAllButtons(true);
        this.flags.OVERRIDE_PANNING = false;
        this.flags.CAMERA_PANNING = false;
        return true;
    }
    animate () {
        const { cursor } = this.Display;
        cursor.save();
        this.Interface.draw(cursor);
        cursor.restore();
        this.draw(true);
        this.Parent.Camera.update();
    }
    async tick (delta) {
        if (!this.flags.CAMERA_PANNING && !this.flags.OVERRIDE_PANNING)
            this.Parent.Camera.untrackAll();
    }
}
