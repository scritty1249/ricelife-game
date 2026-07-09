import { LoadImage, Spritesheet } from "../../animate/animate.js";
import { AudioContext } from "../../audio/audio.js";
import { FrameCounter, Interval, AppCanvas } from "../display.js";
import { LoopController } from "./loop.js";
import { Vector } from "../../geometry/geometry.js";

export class MainController extends LoopController {
    static SETTINGS = {
        RESOLUTION: Math.floor((1/3) * 10) / 10,
        CLICK_DURATION_MS: 90,
        TICKSPEED: 10, // milliseconds, must be lower than framerate
        FPS: 60
    };
    static #AudioCtx;
    static #AssetType = {
        Sprite: (...args) => new Spritesheet(...args),
        Image: (...args) => new LoadImage(...args),
        Audio: undefined
    };
    static #loadAudioContext () {
        this.#AudioCtx = new AudioContext();
        this.#AssetType.Audio = (...args) => this.#AudioCtx.Source(...args);
    }
    static get AssetType () { return this.#AssetType }
    #Loops = {};
    #active;
    #Display;
    #FrameCounter;
    #FrameInterval;
    #TickInterval;
    constructor () {
        // load a context if one doesn't exist already
        if (!MainController.#AudioCtx) MainController.#loadAudioContext();
        super(MainController.#AudioCtx);
        this.#init();
        this.AssetPool.onload.then(() => this.state = this.constructor.STATES.Ready);
    }

    #init () {
        this.#Display = new AppCanvas(window.appCanvas, new Vector(1920, 1080));
        this.#FrameCounter = new FrameCounter(30);
        this.#FrameInterval = new Interval(1000 / this.constructor.SETTINGS.FPS);
        this.#TickInterval = new Interval(this.constructor.SETTINGS.TICKSPEED);

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
    #drawFramerate () {
        const { cursor, size } = this.Display;
        cursor.save();
        cursor.textBaseline = "top";
        cursor.textAlign = "end";
        cursor.fillStyle = "red";
        cursor.font = "24px serif";
        cursor.fillText(this.FrameCounter.fps, size.x - 10, size.y - 10);
        cursor.restore();
    }

    // expects PhaseController
    async transferLoop (newLoop) {
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
        this.state = this.constructor.STATES.Ready;
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
                this.activeLoop.animate();
                if (this.flags.DEBUG) this.#drawFramerate();
                this.FrameCounter.update();
            }
        }
    }
    close () {
        this.state = this.constructor.STATES.Busy;
        for (const Loop of Object.values(this.#Loops))
            Loop.close();
        super.close();
    }
    
    get isMainController () { return true }
    get Display () { return this.#Display }
    get FrameCounter () { return this.#FrameCounter }
    get FrameInterval () { return this.#FrameInterval }
    get TickInterval () { return this.#TickInterval }
    get activeLoop () { return this.#Loops[this.#active] }
}

export class PhaseController extends LoopController {
    #Global;
    constructor (mainController) {
        super(mainController.Audio.Context);
        this.#Global = mainController;
    }
    animate () {}
    get isPhaseController () { return true }
    get Global () { return this.#Global }
}
