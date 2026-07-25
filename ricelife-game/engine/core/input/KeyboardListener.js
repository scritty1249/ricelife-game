import { EventMap } from "../controller/EventMap.js";

export class KeyboardListener {
    #keys = {};
    #listeningTo;
    #enabled = true;
    #events = new EventMap();
    constructor (windowElement) {
        this.#listeningTo = windowElement; // track the object
        this.#listeningTo.addEventListener("keydown", this.#keyDownListener);
        this.#listeningTo.addEventListener("keyup", this.#keyUpListener);
    }

    #generateEvent (keyCode, keyDown) { return `${keyCode}${keyDown}` }
    #keyDownListener = (event) => this.#setKeyState(event, true)
    #keyUpListener = (event) => this.#setKeyState(event, false)
    #setKeyState (event, keyDown) {
        if (this.enabled) {
            this.#rawKeys[event.code] = keyDown;
            this.#events.raiseEvent(this.#generateEvent(event.code, keyDown));
            this.#events.raiseEvent(this.#generateEvent("_", keyDown));
            event?.preventDefault?.();
        }
    }
    #onNextEvent (keyDown, keyCode = undefined) {
        const { promise, resolve } = Promise.withResolvers();
        const event = this.#generateEvent(keyCode || "_", keyDown);
        this.#events.addEventListener(event, resolve, {once: true});
        return promise;
    }

    onNextPress (keyCode = undefined) { return this.#onNextEvent("keydown", keyCode) }
    onNextRelease (keyCode = undefined) { return this.#onNextEvent("keyup", keyCode) }
    keyActive (keyCode) { return this.#keys[keyCode] }
    resetKeyState (keyCode) { this.#setKeyState({code: keyCode}, false) }
    resetState = () => { this.#keys = {} }
    close () {
        this.#events.reset();
        this.#listeningTo.removeEventListener("keydown", this.#keyDownListener);
        this.#listeningTo.removeEventListener("keyup", this.#keyUpListener);
        this.resetState();
    }

    get events () { return this.#events }
    get enabled () { return this.#enabled }
    set enabled (bool) {
        this.resetState();
        return (this.#enabled = bool);
    }
}