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

            if (tileWidth > size.x) size.x = tileWidth + padX + padX;
            size.y += padY * (i ? 1 : 0.5);
            const offsetX = (tileWidth / 2) + padX;
            const offsetY = (tileHeight / 2) + size.y;
            mapButton.setPosition(offsetX, offsetY);
            mapButton.save();
            this.InterfaceLayers.buttons.push(mapButton);
            size.y += tileHeight;
        }
        size.y += padY / 2;
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

    onResize () {
        if (!super.onResize()) return false;
        const { Camera } = this.Parent;
        const { width } = this.Area;
        const mapCount = this.InterfaceLayers.buttons.size || 1;
        const heightSpacing = this.Area.height / mapCount;
        Camera.setTargetSize(width, heightSpacing, true);
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
        const { width } = this.Area;
        const mapCount = this.InterfaceLayers.buttons.size || 1;
        const heightSpacing = this.Area.height / mapCount;
        const offsetY = heightSpacing * ((mapCount - 1) || 1);
        const top = offsetY + (heightSpacing / 2);

        Camera.Viewbox.setPlane(this.Area);
        Camera.Viewbox.min.apply(this.Area.min);
        Camera.Viewbox.min.y += offsetY;
        Camera.Viewbox.max.apply(this.Area.max);
        Camera.setTargetSize(width, heightSpacing, true);
        Camera.lerpFactor = 0.1;
        Camera.scalingBehavior = Camera.constructor.SCALING_BEHAVIOR.Always;
        this.flags.CAMERA_PANNING = true;
        Camera.setPosition(width / 2, top);
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
