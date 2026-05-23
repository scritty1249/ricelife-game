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
    }

    move (amount) {
        this.set(this.#player.position.x + amount);
    }

    set (amount) {
        if (amount < 1 || amount >= this.#range) return;

        // setting position
        const position = this.#player.position;
        const ground = this.#terrain.path.points;
        position.x = amount;
        const hits = this.#terrain.raycast(new Vector(amount, 0), Direction(90), this.#terrainHeight - 1)
        // remove duplicate/junk raycasting hits (i did some shit wrong)
        const hit = (hits.some(({entering}) => !entering) ? hits.filter(({entering}) => !entering) : hits)
            .toSorted((a, b) => b.point.y - a.point.y).at(0);
        position.y = hit.point.y + this.offsetY;

        // setting rotation
        this.#player.rotation.body = rad2deg(hit.angle) + (hit.entering ? 270 : 90);
        // const terrainIdx = ground.findIndex((pt) => pt.eq(position));
        // const points = ground.filter((pt) => pt.x <= position.x + this.#playerWidthRadius && pt.x >= position.x - this.#playerWidthRadius).toSorted((a, b) => b - a);
        // this.#player.rotation.body = points.at(0).angle(...points.slice(1));
    }

    get rotation () {
        return this.#player.rotation.barrel;
    }
    
    get position () {
        return this.#player.position;
    }
}