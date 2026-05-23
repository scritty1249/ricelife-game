import { Vector, Direction } from "../geometry/geometry.js";
import { rad2deg } from "../utils.js";

export class InputListener {
    #keyCodeMap;
    #activeKeys;
    #activeKeysProxy;
    #listeningTo;
    constructor (listenTo, keyCodeMap) {
        this.#keyCodeMap = keyCodeMap;
        this.#activeKeys = Object.fromEntries(Array.from(Object.values(this.#keyCodeMap), (keyCode) => [keyCode, false]));
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
            this.#activeKeys[this.#keyCodeMap[event.code]] = keyDown;
            event.preventDefault();
        }
    }

    get listeningTo () { return this.#listeningTo }
    get activeKeys() { return this.#activeKeysProxy }
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
        this.maxTilt = 130; // range of how much the player's body can tilt before movement is blocked (dont straight straight up walls)
    }

    move (amount) {
        this.set(this.#player.position.x + amount);
    }

    set (amount) {
        if (amount < 1 || amount >= this.#range) return;

        const position = this.#player.position;
        const ground = this.#terrain.path.points;
        const hits = this.#terrain.raycast(new Vector(amount, 0), Direction(90), this.#terrainHeight - 1)
        // remove duplicate/junk raycasting hits (i did some shit wrong)
        const hit = (hits.some(({entering}) => !entering) ? hits.filter(({entering}) => !entering) : hits)
            .toSorted((a, b) => b.point.y - a.point.y).at(0);
        let angle = rad2deg(hit.angle) + (hit.entering ? 270 : 90);
        if (angle < 0) angle += 360;
        angle = angle % 360;

        // check if movement is valid, don't drive straight up walls
        if (!(angle > 360 - (this.maxTilt / 2) || angle < this.maxTilt / 2))
            return false;

        // setting position
        position.x = amount;
        position.y = hit.point.y + this.offsetY;
        // setting rotation
        this.#player.rotation.body = angle;
        return true;
    }

    get rotation () {
        return this.#player.rotation.barrel;
    }
    
    get position () {
        return this.#player.position;
    }
}