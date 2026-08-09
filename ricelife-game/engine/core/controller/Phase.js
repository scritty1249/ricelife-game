import { PointerInterface } from "../input/interface/PointerInterface.js";
import { BoundingBox } from "../geometry/BoundingBox.js";
import { Loop } from "./loop/Loop.js";
import { Camera } from "./display/Camera.js";
import { typeString } from "../Core.js";

// exists within Main loop only
// uses ontick and onanimate instead of tick and animate
export class Phase extends Loop {
    static INPUT_MAP = {};
    #Menus = new Map(); // [!] Menus must never be removed once set
    #Interface = new PointerInterface();
    #Plane = new BoundingBox();
    #Camera;
    #Global;
    #canvasScreenshot;
    constructor (mainController) {
        super(mainController.Audio.Context);
        this.#Global = mainController;
        this.#Camera = new Camera(this.Global.Display);
        this.Interface.Viewbox = this.Camera.Viewbox;
        this.onload.then(() => {
            this.Camera.Viewbox.setPlane(this.Plane);
            this.#attachMenuListeners();
        });
    }

    #attachMenuListeners () {
        const { cursor } = this.Global.Display;
        for (const menu of this.Menus.values()) {
            menu.Events.addEventListener("OPEN", () => {
                if (!this.hasOpenMenu)
                    this.#captureCanvas();
            });
            menu.Events.addEventListener("CLOSE", () => {
                if (!this.hasOpenMenu)
                    this.#releaseCanvasScreenshot();
            });
        }
    }
    #releaseCanvasScreenshot () {
        if (this.#canvasScreenshot) {
            this.#canvasScreenshot.close();
            this.#canvasScreenshot = undefined;
        }
    }
    #drawCanvasScreenshot () {
        if (!this.#canvasScreenshot
            || !this.#canvasScreenshot.width
            || !this.#canvasScreenshot.height
        ) return;
        const { cursor } = this.Global.Display;
        cursor.save();
        cursor.fixed = true;
        cursor.drawImage(this.#canvasScreenshot, 0, 0);
        cursor.restore();
    }
    #captureCanvas (preserveCanvas = false) {
        const originalState = this.state;
        this.state = this.constructor.STATES.Busy;
        const { cursor } = this.Global.Display;
        this.#releaseCanvasScreenshot();
        let original;
        cursor.save();
        if (preserveCanvas) {
            original = cursor.screenshot(false);
        }
        cursor.clear();
        this.drawMenuBackground();
        this.#canvasScreenshot = cursor.screenshot(false);
        if (preserveCanvas) {
            cursor.fixed = true;
            cursor.drawImage(original, 0, 0);
            original.close();
        }
        cursor.restore();
        this.state = originalState;
    }
    #resizeHandler = () => {
        this.onResize();
    }

    drawMenuBackground () { this.onanimate() }
    onResize () {
        if (this.hasOpenMenu) {
            this.#captureCanvas();
            for (const menu of this.Menus.values())
                if (menu.isOpen) menu.onResize();
        }
    }
    drawBackground () {}
    onanimate () { this.Camera.update() }
    animate (clear = true) {
        if (clear) this.Global.Display.cursor.clear();
        let noOpenMenus = true;
        const openMenus = this.Menus
            .values()
            .filter(({isOpen}) => isOpen);
        for (const menu of openMenus) {
            if (noOpenMenus) {
                noOpenMenus = false;
                this.#drawCanvasScreenshot();
            }
            menu.animate();
        }
        if (noOpenMenus) {
            this.onanimate();
        }
    }
    start () {
        this.Global.Display.addResizeListener(this.#resizeHandler);
        this.state = this.constructor.STATES.Ready;
    }
    reset () {
        this.state = this.constructor.STATES.Busy;
        this.Global.Display.removeResizeListener(this.#resizeHandler);
        for (const menu of this.Menus.values())
            if (menu.isOpen) menu.close();
    }
    async ontick (delta) {}
    async tick (delta) {
        super.tick(delta);
        let noOpenMenus = true;
        const openMenus = this.Menus
            .values()
            .filter(({isOpen}) => isOpen);
        for (const menu of openMenus) {
            if (noOpenMenus)
                noOpenMenus = false;
            await menu?.tick?.(delta);
        }
        if (noOpenMenus)
            await this.ontick?.(delta);
    }
    async loadGlobalAsset (key) {
        const { AssetTable } = this.Global;
        if (!(key in AssetTable))
            throw new Error(`[${typeString(this)}]: "${key}" does not exist in global AssetTable`);
        this.AssetPool.add(key, AssetTable[key]);
        return await this.AssetPool.onready(key);
    }
    resolveLoad (value) {
        if (this.Global.flags.DEBUG)
            console.info(`[${typeString(this)}]: Finished loading`);
        super.resolveLoad(value || this);
    }

    get isPhase () { return true }
    get hasOpenMenu () { return this.Menus.values().some(({isOpen}) => isOpen) }
    get Global () { return this.#Global }
    get Interface () { return this.#Interface }
    get Plane () { return this.#Plane }
    get Camera () { return this.#Camera }
    get Menus () { return this.#Menus }
}
