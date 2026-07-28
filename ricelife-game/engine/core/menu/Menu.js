import { Loop } from "../controller/loop/Loop.js";
import { typeString } from "../utils/logging.js";
import { PointerInterface } from "../input/interface/PointerInterface.js";
import { ScreenButton } from "./item/ScreenButton.js";
import { BoundingBox } from "../geometry/BoundingBox.js";

export class Menu extends Loop {
    static STATES = {
        Closed: 4,
        ...Loop.STATES
    };
    #Parent; // the containing Phase this Menu is running in
    #CameraLastState; // state of Parent Phase's Camera before opening
    #InterfaceLayers = {};
    #drawBackgroundCallback;
    #Interface = new PointerInterface();
    #isOpen = false; // private flag
    #Area = new BoundingBox(); // Menu equivalent for Phase.Plane
    constructor (phase, drawBackgroundCallback = undefined) {
        super(phase.Global.Audio.Context);
        this.#drawBackgroundCallback = drawBackgroundCallback;
        this.onload.then(() => this.#initAfterLoad());
    }

    #attachListeners () {
        this.Parent.Global.Display.addResizeListener(this.onResize);
    }
    #detachListeners () {
        this.Parent.Global.Display.removeResizeListener(this.onResize);
    }
    #initAfterLoad () {
        this.#attachListeners();
        this.init();
    }

    async loop () {}
    async loadAsset () {}
    onResize = () => {}
    init () {
        this.store.underButton = new ScreenButton(this.Parent.Display);
        this.flags.INVERT_TRACKING = true;
        this.InterfaceLayers.under = this.Interface.insert();
        this.InterfaceLayers.under.push(this.store.underButton);
        this.InterfaceLayers.under.fixed = true;
    }
    animate () {
        this.#drawBackgroundCallback?.();
    }
    open () {
        this.#CameraLastState = this.Parent.Camera.getState(true);
        this.Parent.Global.Input.pointer.callbacks = this.Interface;
        this.#isOpen = true;
        this.state = this.constructor.STATES.Ready;
    }
    close (returnData = undefined, haltAudio = true) {
        if (haltAudio) this.Audio.Player.stop();
        if (this.#CameraLastState) {
            this.Parent.Camera.setState(this.#CameraLastState);
            this.#CameraLastState = undefined;
        }
        this.Parent.Global.Input.pointer.callbacks = this.Parent.Interface;
        this.#isOpen = false;
        this.state = this.constructor.STATES.Closed;
        this.Events.raiseEvent("EXIT", returnData || {});
    }
    stop () {
        this.state = this.constructor.STATES.Busy;
        this.#detachListeners();
        this.store.underButton.close();
        this.Audio.Player.stop();
        this.state = this.constructor.STATES.Stopped;
    }

    get isMenu () { return true }
    get isOpen () { return this.#isOpen }
    get Parent () { return this.#Parent }
    get Interface () { return this.#Interface }
    get InterfaceLayers () { return this.#InterfaceLayers }
    get Area () { return this.#Area }
}

Object.freeze(Menu.STATES);
