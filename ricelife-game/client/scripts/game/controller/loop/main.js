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
    static #AudioCtx = new AudioContext();
    static #AssetType = {
        Sprite: Spritesheet,
        Image: LoadImage,
        Audio: MainController.#AudioCtx.Source
    };
    static get AssetType () { return this.#AssetType }
    #Loops = {};
    #active;
    #Display;
    #FrameCounter;
    #FrameInterval;
    #TickInterval;
    constructor () {
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

    animate () {
        this.activeLoop.animate();
        this.FrameCounter.update();
    }
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
        newLoop.onload.then(() => this.state = this.constructor.STATES.Ready);
    }
    async loop () {
        if (this.state === this.constructor.STATES.Ready) {
            const { delta } = this.TickInterval;
            if (this.TickInterval.ready) await this.activeLoop?.loop?.(delta);
            if (this.FrameInterval.ready) this.animate();
        }
        requestAnimationFrame(super.loop);
    }
    close () {
        this.state = this.constructor.STATES.Busy;
        for (const Loop of Object.values(this.#Loops))
            Loop.close();
        super.close();
    }
    
    get Display () { return this.#Display }
    get FrameCounter () { return this.#FrameCounter }
    get FrameInterval () { return this.#FrameInterval }
    get TickInterval () { return this.#TickInterval }
    get activeLoop () { return this.#Loops[this.#active] }
}