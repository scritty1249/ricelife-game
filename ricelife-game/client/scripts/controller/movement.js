
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
    #player;
    #playerWidthRadius;
    constructor (terrain, tank, offsetY = 0) {
        this.#player = tank;
        this.#terrain = terrain;
        this.#range = this.#terrain.path.points.slice(0, -2).map((pt) => pt.x).toSorted((a, b) => b - a).at(0); // [!] unsafe math
        this.#playerWidthRadius = Math.floor(this.#player.width / 2);
        this.offsetY = offsetY;
    }

    move (amount) {
        this.set(this.#player.position.x + amount);
    }

    set (amount) {
        if (amount < 1 || amount >= this.#range) return;
        const position = this.#player.position;
        const ground = this.#terrain.path.points;
        position.x = amount;
        position.y =  ground.filter((pt) =>
                Math.abs(pt.x - position.x) < 1) // approximate closest point. Closest within 1 pixel is acceptable
            .toSorted((a, b) => b - a)
            .at(-1).y + this.offsetY;
        const terrainIdx = ground.findIndex((pt) => pt.eq(position));
        const points = ground.filter((pt) => pt.x <= position.x + this.#playerWidthRadius && pt.x >= position.x - this.#playerWidthRadius).toSorted((a, b) => b - a);
        this.#player.rotation.body = points.at(0).angle(...points.slice(1));
    }

    get rotation () {
        return this.#player.rotation.barrel;
    }
    
    get position () {
        return this.#player.position;
    }
}