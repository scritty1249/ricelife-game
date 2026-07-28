import {
    AmmoPool,
    AnimationList,
    Animation,
    ShapeAnimation,
    Vector,
    Color,
    Ray,
    equals,
    BoundingBox,
    Camera,
    drawBlastAnimation,
    IconButton,
    Lobby,
    Phase,
    Actor,
    Model,
    Metadata,
    Profile,
    Puppet
} from "../../core/Core.js"

import { WorkerPool, PoolManager, TerrainCache, CanvasCache } from "../../workers/Core.js";

const INPUT_MAP = {
    Escape: "esc",
    KeyW: "mv+",
    KeyS: "mv-",
    KeyD: "pan+",
    KeyA: "pan-",
    ArrowRight: "aim-", // counterclockwise
    ArrowLeft: "aim+", // clockwise
    ArrowUp: "shot+", // increment shot power
    ArrowDown: "shot-", // deincrement shot power
    Space: "shootActive",
    Digit1: "shot1",
    Digit2: "shot2",
    Digit3: "shot3",
    Digit4: "shot4",
    Digit5: "shot5",
    Digit6: "shot6",
    Digit7: "shot7",
    Digit8: "shot8",
    Digit9: "shot9",
    Digit0: "shot10",
    ShiftLeft: "debug+",
    ShiftRight: "debug+"
};

export class Round extends Phase {
    static WEB_WORKER_PATH = "/engine/workers/Worker.js";
    #AmmoPool = new AmmoPool(new URL('.', import.meta.url).pathname + "../../projectile/types");
    #Players = new Map();
    #Lobby;
    #ActivePlayerID;
    #ActivePlayer;
    #Threaded;
    #Interface;
    #Terrain;
    #Camera;
    #Animations = {
        Main: new AnimationList()
    };
    constructor (mainController, playerID, lobby, terrain) {
        super(mainController);
        this.#ActivePlayerID = playerID;
        this.#Lobby = lobby;
        this.#Terrain = terrain;
        this.#load()
            .then(() => this.resolveLoad())
            .catch((error) => this.rejectLoad(error));
    }

    async #load () {
        const waitPromises = [
            this.#setupThreads(),
            this.Lobby.loadAssets(
                this.#ActivePlayerID,
                this.AssetPool,
                this.AmmoPool,
                this.Global.constructor.AssetType
            )
        ];

        await Promise.all(waitPromises);
    }
    async #setupThreads () {
        const pool = new WorkerPool(new URL(this.constructor.WEB_WORKER_PATH));
        this.#Threaded = new PoolManager(pool, 4, 3);
        this.store.cacheKey = {
            terrain: "lastTerrainState",
            background: "backgroundCanvas"
        };
        const terrain = new TerrainCache(this.Terrain, this.store.cacheKey.terrain);
        const background = new CanvasCache(this.Plane.width, this.Plane.height, this.store.cacheKey.background);
        await Promise.all([
            this.Threaded.setCache(background),
            this.Threaded.setCache(terrain)
        ]);
        await this.Threaded.drawTerrain(this.store.cacheKey.background, this.store.cacheKey.terrain);
        await this.Threaded.updateCache(this.store.cacheKey.background, true);
    }
    #createPlayerActors () {
        for (const [ id, player ] of this.Lobby.Players) {
            this.Players.set(id, actor);
        }
    }

    init () {
        this.store.prerender = Promise.resolve();
        this.store.lastViewbox = {
            size: new Vector(),
            center: new Vector(),
            set: false
        };
        this.store.shot = {
            tracer: undefined,
            current: undefined,
            selected: undefined,
            map: undefined,
            types: undefined,
            impacts: [],
            // [!] for debug overlay
            legend: undefined,
            blasts: [],
            collisions: [],
        };

        this.Audio.Layer.blast = this.Audio.Player.Layer();
        this.Audio.Layer.blast.volume = 0.55;
        this.Audio.Player.volume = 0.35;
    }

    get AmmoPool () { return this.#AmmoPool }
    get Lobby () { return this.#Lobby }
    get ActivePlayer () { return this.#ActivePlayer }
    get Players () { return this.#Players }
    get Threaded () { return this.#Threaded }
    get Terrain () { return this.#Terrain }
    get Animations () { return this.#Animations }
    get onload () { return this.#loadPromise }
}

// [!] recursion limit applies per-player
function distributePlayers (bbox, players, recursionLimit = 10000) {
    const min = bbox.min.x + (bbox.width / 10);
    const max = bbox.max.x - min;
    const spacing = (bbox.width / players.length);
    const range = (max - min) / spacing; 
    const spots = new Set()
    for (const { aimer, mover } of players) {
        let x;
        let added = false;
        let i = 0;
        while (i < recursionLimit) {
            x = (Math.floor(Math.random() * (range + 1)) * spacing) + min;
            if (!spots.has(x) && mover.apply(x, bbox.max.y + 1)) {
                spots.add(x);
                added = true;
                break;
            }
            i++;
        }
        if (!added && i >= recursionLimit) throw new Error("Recusion limit reached while distributing players. Is terrain invalid?");
        aimer.update(players[0].tank.position.add({x: 0, y: bbox.max.y})); // aim straight up and set power to 100% (1)
    }
}
