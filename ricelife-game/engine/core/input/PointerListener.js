import { Vector } from "../math/Vector.js";

export class PointerListener  {
    static POLL_RATE = 16.67; // milliseconds for onhold callbacks (set to avg for 60Hz display)
    static ONDRAG_TOLERANCE = 5**2; // pixels, squared amount of delta movement allowed before it's considered "dragging" instead of "holding"
    #listeningTo; // should be the app canvas instead of the browser window
    #clickMs;
    #onleaveCallback;
    #callbackFns;
    #offset = new Vector();
    #scale = new Vector(1, 1);
    #elementSize = new Vector(0, 0);
    #AppCanvas;
    #holding = {
        started: false,
        origin: new Vector(),
        stamp: undefined,
        pollInterval: undefined
    };
    #dragging = {
        started: false,
        origin: new Vector(),
        delta: new Vector()
    }
    #tracking = {
        exists: false, // is pointer over element?
        position: new Vector(),
        delta: new Vector(), // updated based on last movement event
        totalDelta: new Vector(), // cumulative movement from last pointerdown position
        pinchDelta: -1, // for touch zoom/scroll events
        down: {
            position: new Vector(),
            stamp: undefined   
        },
        up: {
            position: new Vector(),
            stamp: undefined   
        }
    };
    #activePointers = {};
    #clickEventPromises = new Array();
    #enabled = true; // blocks callbacks if set to false, but will still track pointer
    constructor (appCanvas, clickThresholdMs, callbackFns) {
        this.#callbackFns = callbackFns;
        this.#clickMs = clickThresholdMs;
        this.#AppCanvas = appCanvas;
        this.#listeningTo = appCanvas.canvas; // ASSUMES POSITION OF ELEMENT DOES NOT CHANGE - will respond to resize related changes though
        this.#attachListeners();
        this.#updateOffset();
    }

    #attachListeners () {
        this.#AppCanvas.addResizeListener(this.#updateOffset);
        this.#listeningTo.addEventListener("pointermove", this.#updateMove);
        this.#listeningTo.addEventListener("pointerdown", this.#updateDown);
        this.#listeningTo.addEventListener("pointerup", this.#updateUp);
        this.#listeningTo.addEventListener("pointercancel", this.#updateUp);
        this.#listeningTo.addEventListener("pointerenter", this.#updateEnter);
        this.#listeningTo.addEventListener("pointerleave", this.#updateLeave);
        this.#listeningTo.addEventListener("wheel", this.#updateWheel);
    }
    #detachListeners () {
        this.#listeningTo.removeEventListener("pointermove", this.#updateMove);
        this.#listeningTo.removeEventListener("pointerdown", this.#updateDown);
        this.#listeningTo.removeEventListener("pointerup", this.#updateUp);
        this.#listeningTo.removeEventListener("pointercancel", this.#updateUp);
        this.#listeningTo.removeEventListener("pointerenter", this.#updateEnter);
        this.#listeningTo.removeEventListener("pointerleave", this.#updateLeave);
        this.#listeningTo.removeEventListener("wheel", this.#updateWheel);
        this.#AppCanvas.removeResizeListener(this.#updateOffset);
    }
    #setHoldInterval () {
        if (this.#holding.pollInterval) return;
        this.#holding.pollInterval = setInterval(() => {
            if (!this.isActive) return this.#clearHoldInterval();
            if (this.activeDuration > this.#clickMs) {
                if (this.#holding.stamp) {
                    if (!this.#dragging.started) {
                        this.#dragging.origin.apply(this.#tracking.position);
                    }
                    this.#dragging.started = this.#holding.origin.sub(this.#tracking.position).lengthSquared > this.constructor.ONDRAG_TOLERANCE;
                    this.#holding.started = this.#holding.stamp > this.#clickMs && !this.#dragging.started;
                    if (this.isHolding) {
                        this.#holding.origin.apply(this.#tracking.position);
                        this.#callbackFns?.onhold?.(this.position);
                    }
                } else {
                    this.#holding.origin.apply(this.#tracking.position);
                    this.#holding.stamp = performance.now();
                }
            } else if (this.#holding.stamp) {
                this.#holding.stamp = undefined;
                this.#holding.origin.apply(0, 0);
            }
        }, this.constructor.POLL_RATE);
    }
    #clearHoldInterval () {
        if (!this.#holding.pollInterval) return;
        clearInterval(this.#holding.pollInterval);
        this.#holding.pollInterval = undefined;
    }
    #updateLeave = () => {
        this.#onleaveCallback?.();
    }
    #updateDown = (event, callback = true) => { // keep up and down event callbacks seperate for (marginal) perfomance boost
        if (!this.enabled) return;
        this.#activePointers[event.pointerId] = event;
        this.#tracking.exists = true;
        this.#updatePosition(event);
        this.#tracking.up.stamp = undefined; // clear data from last down event
        this.#tracking.down.stamp = performance.now();
        this.#tracking.down.position.apply(this.#tracking.position);
        this.#setHoldInterval();
        if (callback && this.pointerCount === 1) {
            this.#callbackFns?.onpress?.(this.position);
        }
    }
    #updateEnter = (event, callback = true) => {
        this.#updateMove(event, false);
    }
    #updateUp = (event, callback = true) => {
        if (!this.enabled) return;
        const { activeDuration } = this;
        if (event.pointerId in this.#activePointers)
            delete this.#activePointers[event.pointerId];
        this.#updatePosition(event);
        this.#tracking.up.stamp = performance.now();
        this.#tracking.up.position.apply(this.#tracking.position);
        this.#dragging.started = false;
        this.#holding.started = false;
        this.#clearHoldInterval();
        this.#updateDelta(event);
        if (callback && this.pointerCount === 0) {
            this.#callbackFns?.onrelease?.(this.position, this.#tracking.totalDelta.clone());
            // click detection
            if (activeDuration <= this.#clickMs + Number.EPSILON) {
                this.#clickEventPromises.splice(0, this.#clickEventPromises.length)
                    .forEach((resolve) => resolve(event));
                this.#callbackFns?.onclick?.(this.position, this.#tracking.totalDelta.clone());
            }
        }
    }
    #updateMove = (event, callback = true) => {
        if (!this.enabled) return;
        this.#activePointers[event.pointerId] = event;
        this.#tracking.exists = true;
        const { pointerCount } = this;
        if (pointerCount === 1) {
            this.#updatePosition(event);
            this.#updateDelta(event);
            this.#setHoldInterval();
            // drag detection
            if (callback && this.enabled && this.isDragging) {
                if ((this.#callbackFns?.ondrag?.(this.position, this.#tracking.down.position.clone(), this.#dragging.delta.clone())) === null) {
                    // dragging was broken on an item
                    if (this.#tracking.exists)
                        this.#dragging.origin.apply(this.#tracking.position);
                    else
                        this.#dragging.started = false;
                }
            }
        } else if (pointerCount === 2) {
            // touch scroll/zoom detection
            const [p1, p2] = Object.values(this.#activePointers);
            const delta = new Vector(
                p1.clientX - p2.clientX,
                p1.clientY - p2.clientY
            );
            const distance = delta.dot(delta);
            if (this.#tracking.pinchDelta > 0) {
                const point = this.#normalizePoint(new Vector(
                    p1.clientX + p2.clientX,
                    p1.clientY + p2.clientY
                ).div(2, true));
                this.#callbackFns?.onscroll?.(point, delta);
            }
            this.#tracking.pinchDelta = distance;
        }
    }
    #updateWheel = (event, callback = true) => {
        if (!this.enabled) return;
        const { deltaX, deltaY } = event;
        if (callback) {
            this.#callbackFns?.onscroll?.(this.position, new Vector(deltaX, deltaY).mul(this.#scale, true));
        }
    }
    // should be called after #updatePosition()
    #updateDelta (event) {
        const { movementX, movementY } = event;
        this.#tracking.delta.apply(movementX, -movementY);
        if (this.#tracking.down.stamp) {
            this.#tracking.totalDelta.apply(this.#tracking.position.sub(this.#tracking.down.position));
            if (this.#dragging.started) {
                this.#dragging.delta.apply(this.#tracking.position.sub(this.#dragging.origin));
                if (this.isDragging) this.#dragging.origin.apply(this.#tracking.position);
            } else this.#dragging.delta.apply(0, 0);
        } else {
            this.#tracking.totalDelta.apply(0, 0);
            this.#dragging.delta.apply(0, 0);
        }
    }
    #updatePosition (event) {
        const { clientX, clientY } = event;
        this.#tracking.position.apply(clientX, clientY);
        this.#normalizePoint(this.#tracking.position);
    }
    #updateOffset = () => {
        const { position, up, down } = this.#tracking;
        {
            // change any existing position data back to global
            this.#denormalizePoint(position);
            this.#denormalizePoint(this.#holding.origin);
            this.#denormalizePoint(this.#dragging.origin);
            if (up.stamp !== undefined)
                this.#denormalizePoint(up.position);
            if (down.stamp !== undefined)
                this.#denormalizePoint(down.position);
        }
        const { left, top, width, height, bottom } = this.#listeningTo.getBoundingClientRect();
        this.#elementSize.apply(width, bottom); // for y coordinate normalization
        this.#offset.apply(left, top);
        this.#scale.apply(this.#listeningTo.width / width, this.#listeningTo.height / height);
        // make position data relative to new position
        this.#normalizePoint(position);
        this.#normalizePoint(this.#holding.origin);
        this.#normalizePoint(this.#dragging.origin);
        if (up.stamp !== undefined)
            this.#normalizePoint(up.position);
        if (down.stamp !== undefined)
            this.#normalizePoint(down.position);
    }
    #normalizePoint (point) { // this is a mutating operation!
        point.y = this.#elementSize.y - point.y;
        point.sub(this.#offset, true);
        point.mul(this.#scale, true);
        return point; // for chaining
    }
    #denormalizePoint (point) {
        point.div(this.#scale, true);
        point.add(this.#offset, true);
        point.y += this.#elementSize.y;
        return point; // for chaining
    }
    // return a promise that runs on next event
    #onNextEvent (...eventTypes) {
        const { promise, resolve } = Promise.withResolvers();
        const element = this.#listeningTo;
        const handlers = [];
        for (const eventType of eventTypes) {
            const handler = (event) => {
                if (this.enabled) {
                    for (const [type, handle] of handlers)
                        element.removeEventListener(type, handle);
                    resolve(event);
                }
            }
            handlers.push(handler);
            element.addEventListener(eventType, handler);
        }
        return promise;
    }

    resetState () {
        if (this.isDragging || this.isHolding)
            this.#callbackFns?.onrelease?.(this.position, this.delta);
        this.#clearHoldInterval();
        this.#tracking.down.position.apply(0);
        this.#tracking.down.stamp = undefined;
        this.#tracking.up.position.apply(0);
        this.#tracking.up.stamp = undefined;
        this.#tracking.exists = false;
    }
    onNextClick () {
        const { resolve, promise } = Promise.withResolvers();
        this.#clickEventPromises.push(resolve);
        return promise;
    }
    onNextMove () {
        return this.#onNextEvent("pointermove"); 
    }
    onNextPress () {
        return this.#onNextEvent("pointerdown");
    }
    onNextRelease () {
        return this.#onNextEvent("pointerup", "pointercancel");
    }
    close () {
        this.resetState();
        this.#detachListeners();
    }

    get pointerCount () { return Object.keys(this.#activePointers).length }
    get position () { return this.#tracking.position.clone() }
    get delta () { return this.#tracking.delta.clone() }
    get deltaTotal () { return this.#tracking.totalDelta.clone() }
    get isHovering () { return this.#tracking.exists && !this.isActive }
    get isHolding () { return this.#holding.started && this.enabled }
    get isActive () { return this.pointerCount > 0 && this.#tracking.down.stamp !== undefined && this.#tracking.up.stamp === undefined && this.enabled }
    get isDragging () { return this.isActive && this.#dragging.delta.lengthSquared > this.constructor.ONDRAG_TOLERANCE && this.enabled }
    get origin () { return this.isActive ? this.#tracking.down.position.clone() : undefined }
    get dragOrigin () { return this.isDragging ? this.#dragging.origin.clone() : undefined }
    get holdOrigin () { return this.isHolding ? this.#holding.origin.clone() : undefined }
    // milliseconds 
    get holdDuration () { return this.isHolding ? performance.now() - this.#holding.stamp : 0 }
    get activeDuration () { return this.isActive ? performance.now() - this.#tracking.down.stamp : 0 }
    get enabled () { return this.#enabled }
    set enabled (bool) {
        this.resetState();
        return (this.#enabled = bool);
    }
    set callbacks (callbackMap) { return (this.#callbackFns = callbackMap) }
    set onleave (callbackFn) { return (this.#onleaveCallback = callbackFn) }
}
