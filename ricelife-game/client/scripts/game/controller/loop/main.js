import { Spritesheet } from "../../animate/animate.js";
import { LoadImage, AudioContext, LoadFont } from "../../asset/asset.js";
import { FrameCounter, Interval, AppCanvas } from "../display.js";
import { InputListener } from "../player.js";
import { LoopController } from "./loop.js";
import { Vector } from "../../geometry/geometry.js";

export class MainController extends LoopController {
    static #COORDINATE_PLANE_SIZE = new Vector(4000, 1000);
    static SETTINGS = {
        RESOLUTION: Math.floor((1/3) * 10) / 10,
        MAX_VIEWBOX_SCALE: 5,
        CLICK_DURATION_MS: 90,
        TICKSPEED: 10, // milliseconds, must be lower than framerate
        FPS: 60
    };
    static #AudioCtx;
    static #AssetType = {
        Sprite: (...args) => new Spritesheet(...args),
        Image: (...args) => new LoadImage(...args),
        Font: (...args) => new LoadFont(...args),
        Audio: undefined
    };
    static #loadAudioContext () {
        this.#AudioCtx = new AudioContext();
        this.#AssetType.Audio = (...args) => this.#AudioCtx.Source(...args);
    }
    static get AssetType () { return this.#AssetType }
    static get COORDINATE_PLANE_SIZE () { return MainController.#COORDINATE_PLANE_SIZE.clone() } // [!] protect. never modify original
    #Loops = {};
    #active;
    #Display;
    #Input;
    #FrameCounter;
    #FrameInterval;
    #TickInterval;
    #loadPromise = Promise.withResolvers();
    constructor () {
        // load a context if one doesn't exist already
        if (!MainController.#AudioCtx) MainController.#loadAudioContext();
        super(MainController.#AudioCtx);
        this.#init();
        this.#load()
            .then(() => this.state = this.constructor.STATES.Ready)
            .then(() => this.#loadPromise.resolve(this));
    }

    #init () {
        this.#Display = new AppCanvas(window.appCanvas, window, MainController.COORDINATE_PLANE_SIZE);
        this.#FrameCounter = new FrameCounter(30);
        this.#FrameInterval = new Interval(1000 / this.constructor.SETTINGS.FPS);
        this.#TickInterval = new Interval(this.constructor.SETTINGS.TICKSPEED);
        this.#Input = new InputListener(this.Display, this.constructor.SETTINGS.CLICK_DURATION_MS, {}, {});

        this.flags.DEBUG = false;
        
        const { AssetType } = MainController;
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
        AssetTable.tilePing = [AssetType.Audio, undefined, "tilePing", "./assets/sfx/tile-ping.mp3"];
        AssetTable.tileSelect = [AssetType.Audio, undefined, "tileSelect", "./assets/sfx/tile-select.mp3"];
        // Fonts
        AssetTable.defaultFont = [AssetType.Font, undefined, "Michroma", "./assets/interface/fonts/Michroma/Michroma-Regular.ttf"];
        AssetTable.altFont = [AssetType.Font, undefined, "Lexend", "./assets/interface/fonts/Lexend/Lexend-VariableFont_wght.ttf"];
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
    async #load () {
        const defualtFontKey = "altFont";
        this.loadAsset("defaultFont");
        this.loadAsset("altFont");
        await this.AssetPool.onload;
        this.store.DEFAULT_FONT = this.AssetPool.get(defualtFontKey);
    }
    #drawFramerate () {
        const { cursor, size } = this.Display;
        cursor.save();
        cursor.fixed = true;
        cursor.textBaseline = "top";
        cursor.textAlign = "end";
        cursor.fillStyle = "red";
        cursor.font = `24px ${this.store.DEFAULT_FONT.family}`;
        cursor.fillText(this.FrameCounter.fps, size.x - 10, size.y - 10);
        cursor.restore();
    }

    // expects PhaseController
    async transferLoop (newLoop) {
        const prevState = this.state;
        this.state = this.constructor.STATES.Busy;
        const { activeLoop } = this;
        if (activeLoop) {
            if (activeLoop.Threaded) await activeLoop.close();
            else activeLoop.close();
            delete this.#Loops[activeLoop.id];
        }
        this.#Loops[newLoop.id] = newLoop;
        this.#active = newLoop.id;
        await newLoop.onload;
        this.state = prevState;
    }
    async loop () {
        this.tick();
        super.loop();
    }
    async tick () {
        if (this.state === this.constructor.STATES.Ready
            && this.activeLoop?.state === this.constructor.STATES.Ready
        ) {
            if (this.TickInterval.ready) await this.activeLoop?.tick?.(this.TickInterval.lastDelta);
            if (this.FrameInterval.ready) {
                this.activeLoop.animate(true);
                if (this.flags.DEBUG) this.#drawFramerate();
                this.FrameCounter.update();
            }
        }
    }
    close () {
        this.state = this.constructor.STATES.Busy;
        this.Input.close();
        for (const Loop of Object.values(this.#Loops))
            Loop.close();
        super.close();
    }
    
    get isMainController () { return true }
    get Display () { return this.#Display }
    get Input () { return this.#Input }
    get FrameCounter () { return this.#FrameCounter }
    get FrameInterval () { return this.#FrameInterval }
    get TickInterval () { return this.#TickInterval }
    get activeLoop () { return this.#Loops[this.#active] }
    get onload () { return this.#loadPromise.promise }
}

export class PhaseController extends LoopController {
    #Global;
    constructor (mainController) {
        super(mainController.Audio.Context);
        this.#Global = mainController;
    }
    animate (clear = true) {}
    get isPhaseController () { return true }
    get Global () { return this.#Global }
}
