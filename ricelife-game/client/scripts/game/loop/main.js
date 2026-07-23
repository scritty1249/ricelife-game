import { Spritesheet } from "../animate/animate.js";
import { LoadImage, AudioContext, LoadFont } from "../asset/asset.js";
import { Interface } from "../menu/menu.js";
import { InputListener, FrameCounter, Interval, AppCanvas } from "../controller/controller.js";
import { GameLoop } from "./gameloop.js";

import * as Phases from "./phases/phases.js";

export class MainLoop extends GameLoop {
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
    static #PhaseType = {
        Map: 0,
        Round: 1
    };
    static #PhaseMap = new Map([ // [!] no getter- should not be accessible externally
        [0, Phases.MapPhase],
        [1, Phases.RoundPhase]
    ]);
    static #loadAudioContext () {
        this.#AudioCtx = new AudioContext();
        this.#AssetType.Audio = (...args) => this.#AudioCtx.Source(...args);
    }
    static get AssetType () { return this.#AssetType }
    static get PhaseType () { return this.#PhaseType }
    #MAPS;
    #Loops = {};
    #active;
    #Display;
    #Input;
    #FrameCounter;
    #FrameInterval;
    #TickInterval;
    #loadingCallback;
    #loadPromise = Promise.withResolvers();
    constructor (maps, loadingCallbackFn) {
        // load a context if one doesn't exist already
        if (!MainLoop.#AudioCtx) MainLoop.#loadAudioContext();
        super(MainLoop.#AudioCtx);
        this.#init(maps, loadingCallbackFn);
        this.#load()
            .then(() => this.#setupEvents())
            .then(() => this.state = this.constructor.STATES.Ready)
            .then(() => this.Events.raiseEvent("LOADING", {hide: true}))
            .then(() => this.#loadPromise.resolve(this));
    }

    #init (maps, loadingCallback) {
        this.#loadingCallback = loadingCallback;
        this.#MAPS = maps;
        Object.freeze(this.#MAPS);
        this.#Display = new AppCanvas(window.appCanvas, window, MainLoop.COORDINATE_PLANE_SIZE);
        this.#FrameCounter = new FrameCounter(30);
        this.#FrameInterval = new Interval(1000 / this.constructor.SETTINGS.FPS);
        this.#TickInterval = new Interval(this.constructor.SETTINGS.TICKSPEED);
        this.#Input = new InputListener(this.Display, this.constructor.SETTINGS.CLICK_DURATION_MS, {}, {});

        this.flags.DEBUG = false;
        
        const { AssetType } = MainLoop;
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
    #setupEvents () {
        this.Events.addEventListener("LOADING", (data) => this.#loadingCallback?.(data));
        // register and switch phase
        this.Events.addEventListener("PHASE_NEW", (data) => {
            const { Phase = 0, args = [], close = true } = data;
            const PhaseType = MainLoop.#PhaseMap.get(Phase);
            if (!PhaseType) throw new Error(`Unrecognized phase type: ${Phase}`);
            const newPhase = new PhaseType(this, ...args);
            const phaseName = newPhase?.constructor?.name;
            const oldPhaseId = this.#active;
            this.#registerPhase(newPhase)
                .then((id) => this.switchPhase(id, close))
                .catch((err) => {
                    console.error(`[${this.constructor.name}]: Failed to load ${phaseName} phase\n\t${err}`);
                    if (oldPhaseId) {
                        this.switchPhase(oldPhaseId, false);
                        this.activeLoop.reset();
                        this.activeLoop.start();
                    }
                }).then(() => this.Events.raiseEvent("LOADING", {hide: true}));
        });
        // register phase
        this.Events.addEventListener("PHASE_REGISTER", (data) => {
            const { Phase = 0, args = [] } = data;
            const PhaseType = MainLoop.#PhaseMap.get(Phase);
            if (!PhaseType) throw new Error(`Unrecognized phase type: ${Phase}`);
            const newPhase = new PhaseType(this, ...args);
            const phaseName = newPhase?.constructor?.name;
            this.#registerPhase(newPhase)
                .catch((err) => console.error(`[${this.constructor.name}]: Failed to register ${phaseName} phase\n\t${err}`))
                .then(() => this.Events.raiseEvent("LOADING", {hide: true}));
        });
        // switch phase
        this.Events.addEventListener("PHASE_SWITCH", (data) => {
            this.switchPhase(data?.id, data?.close);
            this.Events.raiseEvent("LOADING", {hide: true});
        });
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
    #onLoopError (err) {
        const { Crashed } = this.constructor.STATES;
        const oldState = this.state;
        this.state = Crashed;
        const loopName = this.activeLoop
            ? (this.activeLoop?.constructor?.name || typeof this.activeLoop) + " c"
            : "C";
        const currentState = this.activeLoop
            ? this.activeLoop.state
            : oldState;
        console.error(`[${this.constructor.name}]: ${loopName}rashed${currentState === Crashed ? "" : " fatally"}\n\t`, err);
        this.Events.raiseEvent("LOADING", {hide: false, message: "crashed", error: true});
    }
    async #registerPhase (newLoop) {
        this.#Loops[newLoop.id] = newLoop;
        await newLoop.onload;
        return newLoop.id;
    }
    #onPhaseExit = async (data) => {
        const { activeLoop } = this;
        if (this.flags.DEBUG)
            console.info(`[${this.constructor.name}]: ${activeLoop?.constructor?.name} phase exited`);
        if (activeLoop?.isMapPhase) {
            this.Events.raiseEvent("LOADING", {hide: false, message: "loading map"});
            const { selection } = data;
            this.Events.raiseEvent("PHASE_NEW", {Phase: 1, args: ["/test-lobby.json", selection.src], close: true });
        } else if (activeLoop?.isRoundPhase) {
            this.Events.raiseEvent("LOADING", {hide: false, message: "returning to menu"});
            const { players } = data;
            console.log(`[${this.constructor.name}]: Round won by ${players.length ? players[0].data.team : "no"} team!\n\tSurvivors: ${players.length ? players.map(({data})=>data.profile.name).join(", ") : "none."}`);            
            this.Events.raiseEvent("PHASE_NEW", {Phase: 0, args: [this.#MAPS], close: true });
        }
    }

    async switchPhase (id, close = true) {
        const { activeLoop } = this;
        if (activeLoop) { 
            activeLoop.Events.removeEventListener("EXIT", this.#onPhaseExit);
            if (close) {
                if (this.flags.DEBUG)
                    console.info(`[${this.constructor.name}]: Closing previous phase ${activeLoop?.constructor?.name}`);
                if (activeLoop.Threaded) await activeLoop.close();
                else activeLoop.close();
                delete this.#Loops[activeLoop.id];
            }
        }
        const newLoop = this.#Loops[id];
        this.Input.keyMap = newLoop?.constructor?.INPUT_MAP || {};
        this.Input.pointerMap = newLoop?.Interface || {};
        this.#active = id;
        newLoop.Events.addEventListener("EXIT", this.#onPhaseExit, {once: true});
        if (this.flags.DEBUG)
            console.info(`[${this.constructor.name}]: Switched to ${newLoop?.constructor?.name} phase`);
    }
    async loop () {
        this.tick()
            .catch((err) => this.#onLoopError(err));
        super.loop();
    }
    async tick () {
        if (this.state === this.constructor.STATES.Ready && this.activeLoop) {
            const drawFrame = this.FrameInterval.ready;
            if (this.activeLoop.state === this.constructor.STATES.Ready) {
                if (this.TickInterval.ready) await this.activeLoop?.tick?.(this.TickInterval.lastDelta);
                if (drawFrame) this.activeLoop.animate(true);
            } else if (drawFrame) {
                this.Display.cursor.clear();
            }
            if (drawFrame) {
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
    
    get isMainLoop () { return true }
    get Display () { return this.#Display }
    get Input () { return this.#Input }
    get FrameCounter () { return this.#FrameCounter }
    get FrameInterval () { return this.#FrameInterval }
    get TickInterval () { return this.#TickInterval }
    get activeLoop () { return this.#Loops[this.#active] }
    get onload () { return this.#loadPromise.promise }
}
