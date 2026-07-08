import { AssetPool, AmmoPool, LobbyJSON } from "../lobby/lobby.js";
import { LoadImage, Spritesheet } from "../animate/animate.js";
import { AudioSource } from "../audio/audio.js";
import { TrackableObject } from "../utils/utils.js";
import { FramerateCounter, Interval, AppCanvas } from "./display.js";
import { Vector } from "../geometry/geometry.js";
import * as Menu from "../menu/menu.js"

class LoopController extends TrackableObject {
    #AssetPool = new AssetPool();
    #AssetTable = {};
    #Audio = {
        Context: undefined,
        Player: undefined,
        Layer: {}
    };
    constructor (audioContext) {
        this.#Audio.Context = audioContext;
        this.#Audio.Player = audioContext.Layer();
    }

    loop () {}
    async loadAsset (key, ...args) { return this.AssetPool.add(key, args?.length ? args : this.AssetTable[key]).onload }
    close () {
        this.Audio.Player.stop();
    }

    get isLoopController () { return true }
    get AssetTable () { return this.#AssetTable }
    get AssetPool () { return this.#AssetPool }
    get Audio () { return this.#Audio }
    get onload () { return Promise.resolve(this) }
}

export class MainController extends LoopController {
    static SETTINGS = {
        CLICK_DURATION_MS: 90,
        FPS: 60
    };
    static #AudioCtx = new AudioContext();
    static #AssetType = {
        Sprite: Spritesheet,
        Image: LoadImage,
        Audio: MainController.#AudioCtx.Source
    };
    #Display;
    #FrameCounter;
    #FrameInterval;
    constructor () {
        super(MainController.#AudioCtx);
        this.#Display = new AppCanvas(window.appCanvas, new Vector(1920, 1080));
        this.#FrameCounter = new FramerateCounter(30);
        this.#FrameInterval = new Interval(1000 / this.constructor.SETTINGS.FPS);
        
        const AssetType = MainController.#AssetType;
        const { AssetTable } = this;
        // Images
        AssetTable.fireBtn = [AssetType.Image, undefined, "./assets/interface/buttons/fire.png"];
        AssetTable.selectBtn = [AssetType.Image, undefined, "./assets/interface/buttons/select.png"];
        AssetTable.rightBtn = [AssetType.Image, undefined, "./assets/interface/buttons/right.png"];
        AssetTable.leftBtn = [AssetType.Image, undefined, "./assets/interface/buttons/left.png"];
        AssetTable.shotType = [AssetType.Image, undefined, "./assets/interface/buttons/shot-type.png"];
        // Audio
        AssetTable.fire = [AssetType.Audio, undefined, "fire", "./assets/sfx/fire.mp3"];
        AssetTable.blast = [AssetType.Audio, undefined, "blast", "./assets/sfx/blast.mp3"];
        AssetTable.bouncer = [AssetType.Audio, undefined, "bouncer", "./assets/sfx/bouncer-collision.wav"];
        // Spritesheets
        AssetTable.muzzleFlash = [AssetType.Sprite,
            function (vfx) { vfx.origin.apply(vfx.rawSize.x / 2, vfx.rawSize.y) },
            "./assets/blast/muzzleflash_ss_140x162.png", 140, 162, 25];
        AssetTable.explosion = [AssetType.Sprite,
            function (vfx) {
                vfx.width = 600;
                vfx.origin.apply(
                    vfx.rawSize.x * .5,
                    vfx.rawSize.y * .75
                );
            },
            "./assets/blast/explosion_ss_512x512.png", 512, 512, 25];
    }
    
    get Display () { return this.#Display }
    get FramerateCounter () { return this.#FramerateCounter }
    get FrameInterval () { return this.#FrameInterval }
}

export class RoundController extends LoopController {
    static SETTINGS = {
        BUSY_SECONDS_THRESHOLD: 1.5, // time in seconds before the "busy" screen pops up while tracing shots
        MAX_SHOT_TRACE_SECONDS: 30, // will trigger a landing early if timeout is exceeded- however a landing will only be traced within this time frame so early landings shouldn't be happening... -KT
        GROUND: 350,
        GLOBAL_RESOLUTION: Math.floor((1/3) * 10) / 10,
        TICKSPEED: 10 // milliseconds, must be lower than framerate
    };
    static INPUT_MAP = {
        Escape: "esc",
        KeyW: "mv+",
        KeyS: "mv-",
        KeyD: "mv+",
        KeyA: "mv-",
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
    #AmmoPool = new AmmoPool(new URL('.', import.meta.url).pathname + "../projectile/types");
    #LobbyData;
    #ActivePlayer;
    #Players;
    #Threading;
    #Interface;
    #Main;
    #onload = Promise.withResolvers();
    constructor (mainController, lobbyData) {
        super(mainController.Audio.Context);
        this.#init();
    }

    #init () {
        this.#Main = mainController;
        this.#Interface = new Menu.Interface();
        this.#Input = new InputListener(this.Global.Display.canvas, this.Global.constructor.SETTINGS.CLICK_DURATION_MS, this.constructor.INPUT_MAP, this.Interface);
        this.#Threading = new WorkerPool(new URL(`../workers/web-worker.js`, import.meta.url), 4, 3);
        this.#LobbyData = new LobbyJSON(lobbyData);
        this.AmmoPool.add(...this.LobbyData.ammoTypes());
        this.#Players = Array.from(this.LobbyData.playerInstances());
        this.#ActivePlayer = this.Players.shift();

        this.Audio.Layer.blast = this.Audio.Player.Layer();
        this.Audio.Layer.blast.blast.volume = 0.55;
        this.Audio.Player.volume = 0.35;

        const { AssetTable } = this;
        for (const modelType of this.LobbyData.modelTypes()) {
            AssetTable[modelType + "body"] = [LoadImage, undefined, `./assets/tank/${modelType}/body.png`];
            AssetTable[modelType + "barrel"] = [LoadImage, undefined, `./assets/tank/${modelType}/barrel.png`];
            this.loadAsset(modelType + "body");
            this.loadAsset(modelType + "barrel");
        }
    }
    async #load () {
        const Terrain; // [!] TODO
        const waitPromises = [];
        for (const Player of this.Players) {
            const team = Player.data.team === this.ActivePlayer.team ? "ally" : "enemy";
            const modelType = `${Player.data.model.type}/${team}`;
            waitPromises.push(Player.load(Terrain, this.AssetPool.get(modelType + "body"), this.AssetPool.get(modelType + "barrel"), this.Global.Display.cursor));
        }
        await this.Threading.onload;
        waitPromises.push(
            this.AmmoPool.onload,
            this.Threading.createCache("blastBackground", "CANVAS", ...this.Display.size),
            this.Threading.createCache("background", "CANVAS", ...this.Display.size),
            this.Threading.insertCache("lastTerrainState", "POLY", Terrain.Float64(1))
        );
        await Promise.all(waitPromises);
        this.#onload.resolve(this)
    }

    close () {
        super.close();
        this.Input.close();
        this.Threading.terminate();
    }

    get AmmoPool () { return this.#AmmoPool }
    get LobbyData () { return this.#LobbyData }
    get ActivePlayer () { return this.#ActivePlayer }
    get Players () { return this.#Players }
    get Threading () { return this.#Threading }
    get Global () { return this.#Main }
    get Interface () { return this.#Interface }
    get Input () { return this.#Input }
    get Display () { return this.Main.Display }
    get onload () { return this.#onload.promise }
}