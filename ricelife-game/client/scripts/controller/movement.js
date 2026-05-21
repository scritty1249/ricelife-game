
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
    #ground;
    #position;
    #rotation;
    #range;
    #tankRadius;
    constructor (terrain, tank, offsetY = 0) {
        this.#position = tank.position;
        this.#rotation = tank.rotation;
        this.#ground = terrain.path;
        this.#range = this.#ground.slice(0, -2).map((pt) => pt.x).toSorted((a, b) => b - a).at(0); // [!] unsafe math
        this.#tankRadius = Math.floor(tank.width / 2);
        this.offsetY = offsetY;
    }

    move (amount) {
        this.set(this.#position.x + amount);
    }

    set (amount) {
        if (amount < 1 || amount >= this.#range) return;
        this.#position.x = amount;
        this.#position.y =  this.#ground.points.filter((pt) => pt.x == this.#position.x).toSorted((a, b) => b - a).at(0).y + this.offsetY; // [!] unsafe math
        const terrainIdx = this.#ground.points.findIndex((pt) => pt.eq(this.#position));
        const points = this.#ground.points.filter((pt) => pt.x <= this.#position.x + this.#tankRadius && pt.x >= this.#position.x - this.#tankRadius).toSorted((a, b) => b - a);
        this.#rotation.body = points.at(0).angle(...points.slice(1));
    }

    get rotation () {
        return this.#rotation.barrel;
    }
    
    get position () {
        return this.#position;
    }
}