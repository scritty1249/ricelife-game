import { Loop } from "../controller/loop/Loop.js";
import { typeString } from "../utils/logging.js";
import { PointerInterface } from "../input/interface/PointerInterface.js";
import { ScreenButton } from "./item/ScreenButton.js";
import { BoundingBox } from "../geometry/BoundingBox.js";
import { AppCanvas } from "../controller/display/AppCanvas.js";

export class Menu extends Loop {
    static STATES = {
        Closed: 4,
        ...Loop.STATES
    };
    #backgroundSnapshot;
    #Parent; // the containing Phase this Menu is running in
    #CameraLastState; // state of Parent Phase's Camera before opening
    #InterfaceLayers = {};
    #Interface = new PointerInterface();
    #isOpen = false; // private flag
    #Area = new BoundingBox(); // Menu equivalent for Phase.Plane
    #Display;
    #resizeHash; // hash of screen bbox when onResize() was last called
    constructor (phase) {
        super(phase.Global.Audio.Context);
        this.#Display = new AppCanvas(new OffscreenCanvas(1, 1), window);
        this.#Parent = phase;
        this.Interface.Viewbox = this.Parent.Camera.Viewbox;
        this.#init();
    }

    #init () {
        this.store.underButton = new ScreenButton(this.Parent.Global.Display);
        this.flags.INVERT_TRACKING = true;
        this.InterfaceLayers.under = this.Interface.insert();
        this.InterfaceLayers.under.push(this.store.underButton);
        this.InterfaceLayers.under.fixed = true;
    }

    async loop () {}
    animate () {}
    draw (cover = false) {
        const { cursor } = this.Parent.Global.Display;
        cursor.save();
        cursor.fixed = false;
        if (cover) {
            const { size } = this.Parent.Global.Display;
            cursor.drawImage(this.Display.canvas, 0, 0, size.x, size.y);
        } else
            cursor.drawImage(this.Display.canvas, this.Area.min, this.Area.size);
        cursor.restore();
        this.Display.cursor.clear();
    }
    // returns true if screen dimensions have changed since last resize event, and false otherwise.
    onResize () {
        const oldHash = this.#resizeHash;
        this.#resizeHash = this.Parent.Global.Display.hash;
        return oldHash !== this.#resizeHash;
    }
    open () {
        if (this.isOpen) return false;
        if (this.Parent.Global.flags.DEBUG)
            console.debug(`[${typeString(this)}]: Opened`);
        this.#CameraLastState = this.Parent.Camera.getState(true);
        this.Parent.Global.Input.pointer.callbacks = this.Interface;
        this.Events.raiseEvent("OPEN");
        this.#isOpen = true;
        this.state = this.constructor.STATES.Ready;
        return true;
    }
    close (returnData = undefined, haltAudio = true) {
        if (!this.isOpen) return false;
        if (haltAudio) this.Audio.Player.stop();
        if (this.Parent.Global.flags.DEBUG)
            console.debug(`[${typeString(this)}]: Closed with `, returnData);
        if (this.#CameraLastState) {
            this.Parent.Camera.setState(this.#CameraLastState);
            this.#CameraLastState = undefined;
        }
        this.Parent.Global.Input.pointer.callbacks = this.Parent.Interface;
        this.#isOpen = false;
        this.state = this.constructor.STATES.Closed;
        this.Events.raiseEvent("CLOSE", returnData || {});
        return true;
    }
    stop () {
        this.state = this.constructor.STATES.Busy;
        for (const layer of this.Interface.layers())
            for (const item of layer.items)
                if (item?.isScreenButton)
                    item.close();
        this.Audio.Player.stop();
        this.state = this.constructor.STATES.Stopped;
    }

    get isMenu () { return true }
    get isOpen () { return this.#isOpen }
    get Display () { return this.#Display }
    get Parent () { return this.#Parent }
    get Interface () { return this.#Interface }
    get InterfaceLayers () { return this.#InterfaceLayers }
    get Area () { return this.#Area }
}

Object.freeze(Menu.STATES);
