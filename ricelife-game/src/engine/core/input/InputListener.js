import { KeyboardListener } from "./KeyboardListener.js";
import { PointerListener } from "./PointerListener.js";

export class InputListener { // wrapper for K&M input
    #keyboard;
    #pointer;
    constructor (appCanvas,
        clickThresholdMs,
        pointerCallbacks
    ) {
        this.#keyboard = new KeyboardListener(window);
        this.#pointer = new PointerListener(appCanvas, clickThresholdMs, pointerCallbacks);
        this.pointer.onleave = this.resetState;
    }

    resetState = () => {
        this.keyboard.resetState();
        this.pointer.resetState();
    }
    close () {
        this.keyboard.close();
        this.pointer.close();
    }

    get keyboard () { return this.#keyboard }
    get pointer () { return this.#pointer }
    set enabled (bool) {
        this.keyboard.enabled = bool;
        this.pointer.enabled = bool;
        return bool;
    }
}
