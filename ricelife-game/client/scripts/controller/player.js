import { Vector, Direction, Path, Ray, Circle, Color, Triangle } from "../geometry/geometry.js";
import { rad2deg, deg2rad, floatEqual, clamp, normalizeAngle } from "../utils/utils.js";

export class InputListener { // wrapper for K&M input
    #keyboard;
    #pointer;
    constructor (appCanvas,
        clickThresholdMs,
        keyCodeMap = {},
        pointerCallbacks = {ondrag: (point) => {}, onclick: (point) => {}}
    ) {
        this.#keyboard = new KeyboardListener(window, keyCodeMap);
        this.#pointer = new PointerListener(appCanvas, clickThresholdMs, pointerCallbacks.ondrag, pointerCallbacks.onclick);
    }

    get keyboard () { return this.#keyboard }
    get pointer () { return this.#pointer }
}

export class KeyboardListener {
    #keyCodeMap;
    #activeKeys;
    #activeKeysProxy;
    #listeningTo;
    constructor (listenTo, keyCodeMap) {
        this.#keyCodeMap = keyCodeMap;
        this.#activeKeys = {};
        for (const [keyCode, mapping] of Object.entries(this.#keyCodeMap))
            if (this.#activeKeys[mapping]) this.#activeKeys[mapping][keyCode] = false;
            else this.#activeKeys[mapping] = {[keyCode]: false};
        this.#activeKeysProxy = new Proxy(this.#activeKeys, {
            set: () => false, // fail silently (throws error in strict mode)
            defineProperty: () => false,
            deleteProperty: () => false
        });
        this.#listeningTo = listenTo; // track the object
        this.#listeningTo.addEventListener("keydown", (event) => this.#setKeyState(event, true));
        this.#listeningTo.addEventListener("keyup", (event) => this.#setKeyState(event, false));
    }

    #setKeyState (event, keyDown) {
        if (Object.hasOwn(this.#keyCodeMap, event.code)) {
            this.#activeKeys[this.#keyCodeMap[event.code]][event.code] = keyDown;
            event.preventDefault();
        }
    }

    keyActive (mapping) {
        const mapped = this.activeKeys[mapping];
        if (mapped)
            return Object.values(mapped)?.some((active) => active);
        return undefined;
    }

    get listeningTo () { return this.#listeningTo }
    get activeKeys() { return this.#activeKeysProxy }
}

export class PointerListener  {
    #listeningTo; // should be the app canvas instead of the browser window
    #resizeObserver;
    #clickMs;
    #offset = new Vector();
    #scale = new Vector(1, 1);
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
    constructor (listenTo, clickThresholdMs, dragCallbackFn = (point, origin) => {}, clickCallbackFn = (point) => {}) {
        this.onclick = clickCallbackFn;
        this.ondrag = dragCallbackFn;
        this.#clickMs = clickThresholdMs;
        this.#listeningTo = listenTo; // ASSUMES POSITION OF ELEMENT DOES NOT CHANGE - will response to resize related changes though
        this.#resizeObserver = new ResizeObserver(([{target}]) => this.#updateOffset(target));
        this.#updateOffset(this.#listeningTo);
        this.#resizeObserver.observe(this.#listeningTo);
        this.#listeningTo.addEventListener("pointermove", (event) => this.#updateMove(event));
        this.#listeningTo.addEventListener("pointerdown", (event) => this.#updateDown(event));
        this.#listeningTo.addEventListener("pointerup", (event) => this.#updateUp(event));
    }

    #updateDown (event) { // keep up and down event callbacks seperate for (marginal) perfomance boost
        this.#updatePosition(event);
        this.#tracking.up.stamp = undefined; // clear data from last down event
        this.#tracking.down.stamp = performance.now();
        this.#tracking.down.position.apply(this.#tracking.position);
    }

    #updateUp (event) {
        this.#updatePosition(event);
        // click detection
        if (this.activeDuration <= this.#clickMs + Number.EPSILON)
            this.onclick(this.position);
        this.#tracking.up.stamp = performance.now();
        this.#tracking.up.position.apply(this.#tracking.position);
    }

    #updateMove (event) {
        this.#updatePosition(event);
        // drag detection
        if (this.activeDuration >= this.#clickMs - Number.EPSILON)
            this.ondrag(this.position, this.#tracking.down.position); // pass origin position by reference to avoid making duplicates
    }

    #updatePosition (event) {
        const { clientX, clientY } = event;
        this.#tracking.position.apply(clientX, clientY);
        this.#tracking.position.sub(this.#offset, true);
        this.#tracking.position.mul(this.#scale, true);
    }

    #updateOffset (element) {
        const { position, up, down } = this.#tracking;
        {
            // change any existing position data back to global
            position.div(this.#scale, true);
            position.add(this.#offset, true);
            if (up.stamp !== undefined) {
                up.position.div(this.#scale, true);
                up.position.add(this.#offset, true);
            }
            if (down.stamp !== undefined) {
                down.position.div(this.#scale, true);
                down.position.add(this.#offset, true);
            }
        }
        const { left, top, width, height } = element.getBoundingClientRect();
        this.#offset.apply(left, top);
        this.#scale.apply(element.width / width, element.height / height);
        // make position data relative to new position
        position.mul(this.#scale, true);
        position.add(this.#offset, true);
        if (up.stamp !== undefined) {
            up.position.sub(this.#offset, true);
            up.position.mul(this.#scale, true);
        }
        if (down.stamp !== undefined) {
            down.position.sub(this.#offset, true);
            down.position.mul(this.#scale, true);
        }
    }

    get position () { return this.#tracking.position.clone() }
    get isActive () { return this.#tracking.down.stamp !== undefined && this.#tracking.up.stamp === undefined }
    get isDragging () { return this.activeDuration >= this.#clickMs - Number.EPSILON }
    get dragStart () { return this.isDragging ? this.#tracking.down.position.clone() : undefined }
    // milliseconds 
    get activeDuration () { return this.isActive ? performance.now() - this.#tracking.down.stamp : 0 }
}

export class MovementController { // only moves along X axis
    #terrain;
    #range;
    #terrainHeight;
    #player;
    constructor (terrain, tank, offsetY = 0) {
        this.#player = tank;
        this.#terrain = terrain;
        this.#range = this.#terrain.path.points.slice(0, -2).map((pt) => pt.x).toSorted((a, b) => b - a).at(0); // [!] unsafe math
        this.#terrainHeight = Math.max(...this.#terrain.path.points.map(({y}) => y));
        this.offsetY = offsetY;
    }

    move (amount, resolution = .01) {
        if (Math.abs(amount) >= this.#range || floatEqual(amount, 0)) return;
        const position = this.#player.position;
        const movingRight = amount > 0;
        const targetX = position.x + amount;

        const hits = [...this.#findValidPoints(targetX)];
        if (!hits.length) return false;

        const hit = hits.at(0); // should already be sorted in decesnding order (from targetX to origin)
        // setting position
        position.x = hit.point.x;
        position.y = hit.point.y + this.offsetY;
        // setting rotation
        this.#player.rotation.body = hit.angle;
        return true;
    }

    set (amount, resolution = .01) {
        if (amount < 1 || amount >= this.#range) return;
        const position = this.#player.position;

        const maxHeight = this.#player.height + position.y + this.offsetY; // next position should not be going OVER this - under is still fine. (player would be falling)
        const ray = Ray(new Vector(amount, 0), Direction(90), this.#terrainHeight - 1);
        const hits = this.#terrain.raycast(ray);
        const exiting = hits.some(({entering}) => !entering);


        // remove duplicate/junk raycasting hits (i did some shit wrong)
        const hit = (exiting ? hits.filter(({entering}) => !entering) : hits)
            ?.toSorted((a, b) => b.point.y - a.point.y)?.at(0);
        if (!hit) {
            console.warn("[MovementController] Warning: No valid terrain found for Y position at X", hits);
            return false;
        }

        const angle = this.#normalizeAngle(hit.angle, hit.entering);

        // setting position
        position.x = amount;
        position.y = hit.point.y + this.offsetY;
        // setting rotation
        this.#player.rotation.body = angle;
        return true;
    }

    *#findValidPoints (targetX) { // [!] TODO: THIS WILL ALLOW PLAYERS TO JUMP OVER PIXEL GAPS (INTENDED) BUT ALSO ALLOWS THEM TO PHASE THROUGH WALLS IF THIN ENOUGH
        const { position, width } = this.#player;
        const ray = Ray(new Vector(), Direction(90), this.#terrainHeight - 1);
        const movingRight = targetX > position.x;
        const maxHeight = position.y - (this.#player.height / 2); // next position should not be going OVER this - under is still fine. (player would be falling)
        const nodes = this.#terrain.edgeNodes(true);
        const overlappingHoles = this.#terrain.holes.filter((hole) => hole.isIntersecting(ray));
        const slices = [];
        for (const node of nodes
                .filter(({point}) =>
                    point.y >= maxHeight
                    && (floatEqual(point.x, targetX)
                    || (movingRight && point.x + (width + 1) > position.x && point.x <= targetX)
                    || (!movingRight && point.x - (width + 1) < position.x && point.x >= targetX))
                    && !overlappingHoles.some((hole) => hole.isIntersecting(point)))
                .toSorted((a, b) => Math.abs(targetX - a.point.x) - Math.abs(targetX - b.point.x))) // sort distance from closest to furthest to targetX
            // add to exisiting slice
            if (floatEqual(node.point.x, slices.at(-1)?.at(0)?.point?.x)) slices.at(-1).push(node);
            // push a new slice
            else slices.push([node]);
        for (const slice of slices) {
            slice.sort((a, b) => Math.abs(position.y - b.point.y) - Math.abs(position.y - a.point.y));
            const { point, prevNode, nextNode, hole } = slice.at(-1);
            ray.x = point.x;
            const inter = Path.intersectAngle(ray.at(0), ray.at(-1), prevNode, nextNode);
            const angle = this.#normalizeAngle(inter.angle, inter.entering);
            yield { point, angle, entering: inter.entering };
        }
    }

    get rotation () {
        return this.#player.rotation.barrel;
    }
    
    get position () {
        return this.#player.position;
    }

    #normalizeAngle (radians, pointingOut) {
        let degrees = rad2deg(radians) + (pointingOut ? 270 : 90);
        if (degrees < 0) degrees += 360;
        return degrees % 360;
    }
}

export class AimController { // takes control of rotation for a Tank barrel
    #player;
    #radius;
    #rotation;
    #power;
    #pointerPosition; // player last recorded click location
    #pointerRecorded = false; // sentinal value
    #display;
    constructor (tank, radius,
        circleColor = new Color(255, 255, 255, .025 * 255),
        beamColor = new Color(255, 255, 255, .05 * 255),
        coneColor = new Color(255, 255, 255, 0.075 * 255),
        resolution = .25
    ) {
        this.#player = tank;
        this.#radius = radius;
        this.#power = 1;
        this.#rotation = this.#player.rotation.barrel; // degrees
        this.#pointerPosition = new Vector();
        {
            const fullBeamWidth = this.#radius / 4;
            const fullConeWidth = fullBeamWidth / 3;
            this.#display = {
                circle: {
                    shape: new Circle(new Vector(), radius, resolution), // pass position by reference
                    color: circleColor
                },
                // [!] running out of names...
                triangle: { // outer
                    shape: new Triangle(new Vector(), new Vector(fullBeamWidth, this.#radius), resolution),
                    minWidth: fullBeamWidth / 3,
                    widthMultiplier: (fullBeamWidth / 3) * 1.5,
                    color: beamColor
                },
                cone: { // inner
                    shape: new Triangle(new Vector(), new Vector(fullConeWidth, this.#radius), resolution),
                    minWidth: fullConeWidth / 3,
                    widthMultiplier: (fullConeWidth / 3) * 1.5,
                    color: coneColor
                }
            };
        }
    }

    draw (ctx) {
        const { circle, triangle, cone } = this.#display;
        const position = this.#player.relativePosition;
        circle.shape.position.apply(position);
        triangle.shape.position.apply(position);
        cone.shape.position.apply(position);
        ctx.save();
        this.#drawPowerCircle(ctx);
        ctx.clip();
        this.#drawAngleTriangle(ctx, triangle);
        this.#drawAngleTriangle(ctx, cone);
        ctx.restore();
    }

    inClickRange (point) {
        const { shape } = this.#display.circle;
        shape.updatePath();
        return shape.isIntersecting(point);
    }

    update (point) { // updates barrel too
        if (!this.#pointerRecorded) {
            this.#pointerRecorded = true;
            this.#pointerPosition.apply(point.x, point.y);
        } else this.pointer.apply(point); // prefer the getter when possible
        this.rotation = this.#angleFromPointer();
        this.power = this.#powerFromPointer();
        // point triangle at pointer position- if we don't get another update, hold the same angle
        this.#updateTriangles();
    }

    #updateTriangles () { // updates "beam" and "cone" triangle based on barrel angle. Does not update barrel- stored angle takes precedence over angle derived from pointer here
        {
            const { shape, minWidth, widthMultiplier } = this.#display.triangle;
            shape.angle = this.#rawAngle;
            shape.position.apply(this.#player.relativePosition);
            shape.size.y = this.#radius * this.power * .95;
            if (floatEqual(this.power, 1)) shape.size.y = this.#radius;
            shape.size.x = minWidth + (widthMultiplier * this.power ** 5);
            shape.updatePath();
        }
        {
            const { shape, minWidth, widthMultiplier } = this.#display.cone;
            shape.angle = this.#rawAngle;
            shape.position.apply(this.#player.relativePosition);
            shape.size.y = this.#radius * this.power;
            shape.size.x = minWidth + (widthMultiplier * this.power ** 5);
            shape.updatePath();
        }
    }

    #drawPowerCircle (ctx) {
        const { shape, color } = this.#display.circle;
        ctx.save();
        ctx.fillStyle = color.toString();
        shape.draw(ctx, true);
        ctx.fill();
        ctx.restore();
    }

    #drawAngleTriangle (ctx, triangle) {
        const { shape, color } = triangle;
        ctx.save();
        ctx.fillStyle = color.toString();
        ctx.beginPath();
        shape.draw(ctx, false);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    #powerFromPointer () { return this.#player.relativePosition.distance(this.pointer) / this.#radius } // unclamped
    #angleFromPointer () { return normalizeAngle(rad2deg(this.pointer.angle(this.#player.relativePosition)) - 90) } // normalized
    #rawAngleFromPointer () { return this.#player.relativePosition.angle(this.pointer) }

    get #rawAngle () { return deg2rad(this.rotation - 90) } // un-normalized, and in radians (meant for updating Shapes)
    get pointer () { if (this.#pointerRecorded) return this.#pointerPosition; else throw new Error("[AimController] Error: Pointer position not set") }
    get radius () { return this.#radius }
    get power () { return this.#power }
    set power (value) {
        const result = this.#power = clamp(value, 0, 1);
        this.#updateTriangles();
        return result;
    }
    get rotation () { return this.#rotation }
    set rotation (degrees) {
        const result = this.#player.rotation.barrel = this.#rotation = degrees;
        this.#updateTriangles();
        return result;
    }
}
