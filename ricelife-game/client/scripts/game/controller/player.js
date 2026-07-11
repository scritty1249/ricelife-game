import { Vector, Ray, Circle, Color, Triangle } from "../geometry/geometry.js";
import { floatEqual, clamp, TrackableObject } from "../utils/utils.js";

export class InputListener { // wrapper for K&M input
    #keyboard;
    #pointer;
    constructor (appCanvas,
        clickThresholdMs,
        keyCodeMap = {},
        pointerCallbacks = {ondrag: (point) => {}, onclick: (point) => {}}
    ) {
        this.#keyboard = new KeyboardListener(window, keyCodeMap);
        this.#pointer = new PointerListener(appCanvas, clickThresholdMs, pointerCallbacks);
        this.pointer.listeningTo.addEventListener("pointerleave", this.resetState);
    }

    resetState = () => {
        this.keyboard.resetState();
        this.pointer.resetState();
    }
    close () {
        this.pointer.listeningTo.removeEventListener("pointerleave", this.resetState);
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
    set keyMap (map) { return (this.keyboard.keyCodeMap = map) }
    set pointerMap (map) { return (this.pointer.callbackFns = map) }
}

class KeyboardListener {
    #keyCodeMap;
    #activeKeys;
    #activeKeysProxy;
    #listeningTo;
    #enabled = true;
    constructor (windowElement, keyCodeMap) {
        this.#keyCodeMap = keyCodeMap;
        this.#initKeyMap();
        this.#listeningTo = windowElement; // track the object
        this.#listeningTo.addEventListener("keydown", this.#keyDownListener);
        this.#listeningTo.addEventListener("keyup", this.#keyUpListener);
    }

    #initKeyMap () {
        this.#activeKeys = {};
        for (const [keyCode, mapping] of Object.entries(this.#keyCodeMap))
            if (this.#activeKeys[mapping]) this.#activeKeys[mapping][keyCode] = false;
            else this.#activeKeys[mapping] = {[keyCode]: false};
        this.#activeKeysProxy = new Proxy(this.#activeKeys, {
            set: () => false, // fail silently (throws error in strict mode)
            defineProperty: () => false,
            deleteProperty: () => false
        });
    }
    #keyDownListener = (event) => this.#setKeyState(event, true)
    #keyUpListener = (event) => this.#setKeyState(event, false)
    #setKeyState (event, keyDown) {
        if (this.enabled && Object.hasOwn(this.#keyCodeMap, event.code)) {
            this.#activeKeys[this.#keyCodeMap[event.code]][event.code] = keyDown;
            event?.preventDefault?.();
        }
    }
    #onNextEvent (eventType, keyCode = undefined) {
        const { promise, resolve } = Promise.withResolvers();
        const element = this.#listeningTo;
        const handler = (event) => {
            if (this.enabled && (keyCode === undefined || event.code === keyCode)) {
                element.removeEventListener(eventType, handler);
                resolve(event);
            }
        }
        element.addEventListener(eventType, handler);
        return promise;
    }

    onNextPress (keyCode = undefined) { return this.#onNextEvent("keydown", keyCode) }
    onNextRelease (keyCode = undefined) { return this.#onNextEvent("keyup", keyCode) }
    keyActive (mapping) {
        const mapped = this.activeKeys[mapping];
        if (mapped)
            return Object.values(mapped)?.some((active) => active);
        return undefined;
    }
    resetKeyState (keyCode) {
        this.#setKeyState({code: keyCode}, false);
    }
    resetState () {
        for (const mapping of Object.values(this.#activeKeys))
            for (const key of Object.keys(mapping))
                mapping[key] = false;
    }
    close () {
        this.resetState();
        this.#listeningTo.removeEventListener("keydown", this.#keyDownListener);
        this.#listeningTo.removeEventListener("keyup", this.#keyUpListener);
    }

    get listeningTo () { return this.#listeningTo }
    get activeKeys() { return this.#activeKeysProxy }
    set keyCodeMap (map) {
        const result = (this.#keyCodeMap = map);
        this.#initKeyMap();
        return result;
    }
    get enabled () { return this.#enabled }
    set enabled (bool) {
        this.resetState();
        return (this.#enabled = bool);
    }
}

class PointerListener  {
    #listeningTo; // should be the app canvas instead of the browser window
    #clickMs;
    #callbackFns;
    #offset = new Vector();
    #scale = new Vector(1, 1);
    #elementSize = new Vector(0, 0);
    #AppCanvas;
    #holding = {
        isHolding: false,
        timeout: undefined
    };
    #tracking = {
        position: new Vector(),
        down: {
            position: new Vector(),
            stamp: undefined   
        },
        up: {
            position: new Vector(),
            stamp: undefined   
        }
    };
    #clickEventPromises = new Array();
    #enabled = true; // blocks callbacks if set to false, but will still track pointer
    constructor (appCanvas, clickThresholdMs, callbackFns) {
        this.#callbackFns = callbackFns;
        this.#clickMs = clickThresholdMs;
        this.#AppCanvas = appCanvas;
        this.#listeningTo = appCanvas.canvas; // ASSUMES POSITION OF ELEMENT DOES NOT CHANGE - will respond to resize related changes though
        this.#AppCanvas.addResizeListener(this.#updateOffset);
        this.#updateOffset();
        this.#listeningTo.addEventListener("pointermove", this.#updateMove);
        this.#listeningTo.addEventListener("pointerdown", this.#updateDown);
        this.#listeningTo.addEventListener("pointerup", this.#updateUp);
    }

    #setHoldTimeout () {
        const { position } = this;
        this.#clearHoldTimeout();
        this.#holding.timeout = setTimeout(() => {
            this.#holding.isHolding = (this.isActive && position.eq(this.position))
        }, this.#clickMs);
    }
    #clearHoldTimeout () {
        this.#holding.isHolding = false;
        if (this.#holding.timeout) {
            clearTimeout(this.#holding.timeout);
            this.#holding.timeout = undefined;
        }
    }
    #updateDown = (event) => { // keep up and down event callbacks seperate for (marginal) perfomance boost
        if (!this.enabled) return;
        this.#updatePosition(event);
        this.#tracking.up.stamp = undefined; // clear data from last down event
        this.#tracking.down.stamp = performance.now();
        this.#tracking.down.position.apply(this.#tracking.position);
        this.#setHoldTimeout();
        this.#callbackFns?.onpress?.(this.position);
    }
    #updateUp = (event) => {
        if (!this.enabled) return;
        this.#updatePosition(event);
        this.#tracking.up.stamp = performance.now();
        this.#tracking.up.position.apply(this.#tracking.position);
        this.#clearHoldTimeout();
        this.#callbackFns?.onrelease?.(this.position, this.#tracking.up.position.sub(this.#tracking.down.position) || new Vector(0, 0));
        // click detection
        if (this.activeDuration <= this.#clickMs + Number.EPSILON) {
            this.#clickEventPromises.splice(0, this.#clickEventPromises.length)
                .forEach((resolve) => resolve(event));
            this.#callbackFns?.onclick?.(this.position, this.#tracking.down.position);
        }
    }
    #updateMove = (event) => {
        this.#updatePosition(event);
        this.#setHoldTimeout();
        // drag detection
        if (this.activeDuration >= this.#clickMs - Number.EPSILON && this.enabled)
            this.#callbackFns?.ondrag?.(this.position, this.#tracking.down.position); // pass origin position by reference to avoid making duplicates
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
    #onNextEvent (eventType) {
        const { promise, resolve } = Promise.withResolvers();
        const element = this.#listeningTo;
        const handler = (event) => {
            if (this.enabled) {
                element.removeEventListener(eventType, handler);
                resolve(event);
            }
        }
        element.addEventListener(eventType, handler);
        return promise;
    }

    resetState () {
        this.#clearHoldTimeout();
        this.#tracking.down.position.apply(0);
        this.#tracking.down.stamp = undefined;
        this.#tracking.up.position.apply(0);
        this.#tracking.up.stamp = undefined;
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
        return this.#onNextEvent("pointerup");
    }
    close () {
        this.resetState();
        this.#listeningTo.removeEventListener("pointermove", this.#updateMove);
        this.#listeningTo.removeEventListener("pointerdown", this.#updateDown);
        this.#listeningTo.removeEventListener("pointerup", this.#updateUp);
        this.#AppCanvas.removeEventListener(this.#updateOffset);
    }

    get listeningTo () { return this.#listeningTo }
    get position () { return this.#tracking.position.clone() }
    get isHolding () { return this.#holding.isHolding = (this.isActive && this.#holding.isHolding) && this.enabled }
    get isActive () { return this.#tracking.down.stamp !== undefined && this.#tracking.up.stamp === undefined && this.enabled }
    get isDragging () { return this.activeDuration >= this.#clickMs - Number.EPSILON && this.enabled }
    get dragStart () { return this.isDragging ? this.#tracking.down.position.clone() : undefined }
    // milliseconds 
    get activeDuration () { return this.isActive ? performance.now() - this.#tracking.down.stamp : 0 }
    set callbackFns (callbackMap) { return (this.#callbackFns = callbackMap) }
    get enabled () { return this.#enabled }
    set enabled (bool) {
        this.resetState();
        return (this.#enabled = bool);
    }
}

export class GravityController { // lighter-weight, seperate for web workers. computes a player's new Y position given a terrain and X position
    static computePosition (position, heightOffset, terrain) { // returns an intersection hit
        const pts = terrain.edgePoints;
        const terrainElevations = pts.map(({y}) => y);
        const terrainHeight = Math.max(...terrainElevations) - Math.min(...terrainElevations);
        const ray = new Ray(new Vector(position.x, position.y + heightOffset), Vector.fromAngle((3 * Math.PI) / 2), terrainHeight + 1);
        const hits = terrain.raycast(ray);
        const hasExiting = hits.some(({entering}) => !entering);
        const hit = (hasExiting ? hits.filter(({entering}) => entering) : hits)
            ?.toSorted((a, b) => b.point.y - a.point.y)?.at(0);
        if (!hit)
            console.warn(`[${this.constructor.name}] Warning: No valid terrain found for Y position (from ${ray.at(0).y}) at X ${position.x}`, hits);
        else
            hit.angle -= Math.PI / 2;
        return hit;
    }
}

export class MovementController { // only moves along X axis
    #terrainHash;
    #terrain;
    #range;
    #terrainHeight;
    #player;
    offsetY;
    climbHeight;
    constructor (terrain, tank, offsetY = 0, climbHeight = undefined) {
        this.#player = tank;
        this.#terrain = terrain;
        this.offsetY = offsetY;
        this.climbHeight = climbHeight;
        this.#computeTerrainData();
    }

    #setPlayer (x, y, angle) { // takes raw terrain normal(angle) and x,y coord, and sets player position and rotation with defined offsets
        const offset = this.#calculateOffset(angle);
        this.#player.position.apply(x, y + offset);
        this.#player.rotation.body = angle - (Math.PI / 2);
    }
    #calculateOffset (bodyAngle) {
        const angle = bodyAngle || this.#player.rotation.body + (Math.PI / 2);
        return this.offsetY * Math.sin(angle);
    }
    #computeTerrainData () {
        const hash = this.#terrain.hash;
        if (this.#terrainHash === hash) return;
        this.#terrainHash = hash;
        const pts = this.#terrain.edgePoints;
        this.#range = pts.map((pt) => pt.x).toSorted((a, b) => b - a).at(0); // [!] unsafe math
        const terrainElevations = pts.map(({y}) => y);
        this.#terrainHeight = Math.max(...terrainElevations) - Math.min(...terrainElevations);
    }
    #raycastPosition (x, y = undefined) {
        const maxHeight = (y || this.#player.position.y)
            + (this.climbHeight * Math.sin(this.#player.rotation.body + (Math.PI/2)));
        const ray = new Ray(new Vector(x, maxHeight), Vector.fromAngle((3 * Math.PI) / 2), maxHeight + 1);
        const hits = this.#terrain.raycast(ray);
        if (!hits.length) return undefined;
        const hasExiting = hits.some(({entering}) => !entering);
        const hit = (hasExiting ? hits.filter(({entering}) => entering) : hits)
            ?.toSorted((a, b) => b.point.y - a.point.y)?.at(0);
        return hit;
    }

    move (amount) {
        this.#computeTerrainData();
        if (Math.abs(amount) >= this.#range || floatEqual(amount, 0)) return;
        const targetX = this.#player.position.x + amount;
        const hit = this.#raycastPosition(targetX);
        if (!hit) return false;
        this.#setPlayer(hit.point.x, hit.point.y, hit.angle);
        return true;
    }
    apply (x, y = 0) {
        this.#computeTerrainData();
        if (x?.isVector) {
            y = x.y;
            x = x.x;
        }
        const hit = this.#raycastPosition(x, y);
        if (!hit) {
            console.warn(`[${this.constructor.name}] Warning: No valid terrain found for Y position from (${x}, ${y})`);
            return false;
        }
        this.#setPlayer(x, hit.point.y, hit.angle);
        return true;
    }
    
    get position () {
        return this.#player.position;
    }
}

export class AimController extends TrackableObject { // takes control of rotation for a Tank barrel
    #player;
    #radius;
    #rotation;
    #power;
    #pointerPosition; // player last recorded click location
    #pointerRecorded = false; // sentinal value
    #display;
    constructor (tank, radius,
        circleColor = new Color(255, 255, 255, .025),
        beamColor = new Color(255, 255, 255, .05),
        coneColor = new Color(255, 255, 255, 0.075),
    ) {
        super();
        this.#player = tank;
        this.#radius = radius;
        this.#power = 1;
        this.#rotation = this.#player.rotation.barrel; // degrees
        this.#pointerPosition = new Vector();
        {
            const fullBeamWidth = this.#radius / 3;
            const fullConeWidth = fullBeamWidth / 2;
            const circle = new Circle(this.#radius);
            const outerTriangle = new Triangle();
            outerTriangle.bottomLength = fullBeamWidth;
            outerTriangle.height = this.#radius;
            const innerTriangle = outerTriangle.clone();
            innerTriangle.bottomLength = fullConeWidth;

            this.#display = {
                circle: {
                    shape: circle,
                    color: circleColor
                },
                // [!] running out of names...
                triangle: { // outer
                    shape: outerTriangle,
                    minWidth: fullBeamWidth / 3,
                    widthMultiplier: (fullBeamWidth / 3) * 1.5,
                    color: beamColor
                },
                cone: { // inner
                    shape: innerTriangle,
                    minWidth: fullConeWidth / 3,
                    widthMultiplier: (fullConeWidth / 3) * 1.5,
                    color: coneColor
                }
            };
        }
    }

    draw (cursor) {
        const { circle, triangle, cone } = this.#display;
        const position = this.#player.relativePosition;
        // only need to update positions
        circle.shape.moveTo(position);
        triangle.shape.moveTo(position);
        cone.shape.moveTo(position);

        cursor.save();
        this.#drawPowerCircle(cursor);
        cursor.clip();
        this.#drawAngleTriangle(cursor, triangle);
        this.#drawAngleTriangle(cursor, cone);
        cursor.restore();
    }

    update (point) { // updates barrel too
        if (!this.#pointerRecorded) {
            this.#pointerRecorded = true;
            this.#pointerPosition.apply(point);
        } else this.pointer.apply(point); // prefer the getter when possible
        this.#rotation = this.#player.rotation.barrel = this.#angleFromPointer();
        this.#power = clamp(this.#powerFromPointer(), 0, 1);
        // point triangle at pointer position- if we don't get another update, hold the same angle
        this.#updateTriangles();
    }

    // support for clickable object type
    isOver (point) {
        const { shape } = this.#display.circle;
        return shape.isIntersecting(point);
    }
    ondrag (point) { this.update(point) }
    onclick (point) { this.update(point) }

    #updateTriangles () { // updates "beam" and "cone" triangle based on barrel angle. Does not update barrel- stored angle takes precedence over angle derived from pointer here
        const angle = this.rotation;
        const position = this.#player.relativePosition;
        const { radius, power } = this;
        const expPow = power ** 4; // for scaling width of triangles
        {
            const { shape, minWidth, widthMultiplier } = this.#display.triangle;
            shape.bottomLength = minWidth + (widthMultiplier * expPow);
            shape.height = radius * power * (floatEqual(power, 1) ? 1 : .95);
            shape.transformation.offset = position.sub(shape.origin);
            shape.transformation.angle = angle;
            shape.applyTransformation();
        }
        {
            const { shape, minWidth, widthMultiplier } = this.#display.cone;
            shape.bottomLength = minWidth + (widthMultiplier * expPow);
            shape.height = radius * power;
            shape.transformation.offset = position.sub(shape.origin);
            shape.transformation.angle = angle;
            shape.applyTransformation();
        }
    }

    #drawPowerCircle (cursor) {
        const { shape, color } = this.#display.circle;
        cursor.save();
        cursor.fillStyle = color.toString();
        shape.draw(cursor, true);
        cursor.fill();
        cursor.restore();
    }

    #drawAngleTriangle (cursor, triangle) {
        const { shape, color } = triangle;
        cursor.save();
        cursor.fillStyle = color.toString();
        cursor.beginPath();
        shape.draw(cursor, false);
        cursor.closePath();
        cursor.fill();
        cursor.restore();
    }

    #powerFromPointer () { return this.#player.relativePosition.distance(this.pointer) / this.#radius } // unclamped
    #angleFromPointer () { return this.pointer.angle(this.#player.relativePosition) - (Math.PI / 2) } // normalized

    get pointer () { if (this.#pointerRecorded) return this.#pointerPosition; else throw new Error(`[${this.constructor.name}] Error: Pointer position not set`) }
    get radius () { return this.#radius }
    get power () { return this.#power }
    set power (value) {
        const result = this.#power = clamp(value, 0, 1);
        this.#updateTriangles();
        return result;
    }
    get rotation () { return this.#rotation }
    set rotation (radians) {
        const result = this.#player.rotation.barrel = this.#rotation = radians;
        this.#updateTriangles();
        return result;
    }
}
