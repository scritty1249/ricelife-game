import { InputListener, MovementController, TankController, AppCanvas, AimController, WorkerController } from "./controller/controller.js";
import { Vector, Direction, Color, Polygon, Ray, Path } from "./geometry/geometry.js";
import { drawCircle, drawMarker, drawLine, drawText, outlineImage } from "./utils/utils.js";
import { drawTerrain, generateTerrain, generateWave } from "./terrain/terrain.js";
import { LoadImage, Spritesheet, Animation, AnimationList } from "./animate/animate.js";
import { WorkerPool } from "./workers/pool.js";
import { AudioContext } from "./audio/audio.js";
import * as Menu from "./menu/menu.js"
import * as Ammo from "./projectile/ammo-types.js";

const MAX_SHOT_TRACE_SECONDS = 30; // will trigger a landing early if timeout is exceeded- however a landing will only be traced within this time frame so early landings shouldn't be happening... -KT
const FPS = 60;
const GROUND = 350;
const GLOBAL_RESOLUTION = Math.floor((1/3) * 10) / 10;
const CLICK_DURATION_MS = 90;
const INPUT_MAP = {
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
    Digit0: "shot10"
};

// [!] for debugging
const URL_PARAMS = new URLSearchParams(window?.location?.search);
const DEBUG_ENABLED = () => window?.debugTools || (URL_PARAMS.get("debug") === "true" && window?.debugTools !== false);

export async function load () {
    const body = new LoadImage("./assets/tank/body.png").onload;
    const barrel = new LoadImage("./assets/tank/barrel.png").onload;
    const testExplosion = new Spritesheet("./assets/blast/explosion_ss_512x512.png", 512, 512).onload;
    const testMuzzleFlash = new Spritesheet("./assets/blast/muzzleflash_ss_140x162.png", 140, 162).onload;
    const AudioCtx = new AudioContext();
    const AudioPlayer = AudioCtx.Layer();
    const audioLayers = {};
    {
        // setting up audio layers
        audioLayers.blast = AudioPlayer.Layer();
        audioLayers.blast.volume = .55;
    }
    // setting global audio
    AudioPlayer.volume = 0.35;
    
    const buttons = Promise.all([
        new LoadImage("./assets/interface/buttons/fire.png").onload,
        new LoadImage("./assets/interface/buttons/select.png").onload,
        new LoadImage("./assets/interface/buttons/right.png").onload,
        new LoadImage("./assets/interface/buttons/left.png").onload,
        new LoadImage("./assets/interface/buttons/shot-type.png").onload
    ]);
    const sfx = Promise.all([
        AudioCtx.Source("fire", "./assets/sfx/fire.mp3").onload,
        AudioCtx.Source("blast", "./assets/sfx/blast.mp3").onload,
        AudioCtx.Source("bouncer", "./assets/sfx/bouncer-collision.wav").onload
    ]);
    const WorkerManager = new WorkerPool(new URL(`./workers/web-worker.js`, import.meta.url), 4, 3);
    await WorkerManager.initPromise
        .catch(() => console.error("[Main] Error: WorkerPool size is zero"));
    init(WorkerManager, AudioCtx, AudioPlayer, audioLayers, await body, await barrel, await testExplosion, await testMuzzleFlash, await buttons, await sfx);
}

async function fireProjectile (shot, state, config) { // [!} laziness
    setTurn(state, false);
    drawFrame(state, config); // draw one last frame so the game doesn't look like it just froze
    const projectile = new shot(state.tanks[config.playerTank].barrelPos, state.aimer.rotation + (3 * (Math.PI / 2)), state.aimer.power);
    projectile.colliders.push(state.terrain);
    const muzzleFlash = generateMuzzleFlash(state, config);
    const landing = await state.threading.traceProjectile("blastTerrain", projectile, config.traceIncrement, config.traceMaxTime);
    state.blastTerrain = undefined;
    state.impactData = [];
    if (landing.blasts.length) {
        const blasts = landing.blasts; // should be sorted
        state.redrawJob = state.threading.drawBlastedTerrains(1, "blastTerrain", config.display.size, config.terrain, ...blasts);
        const { intervals: blastIntervals, polygon: blastTerrain } = await state.redrawJob;
        state.animations.blast = new AnimationList();
        const blastAudioLayer = config.audio.layers.blast;
        for (const blastInterval of blastIntervals) {
            const { frame, delay, blasts } = blastInterval;
            // bundle callbacks to trigger later
            const impact = {
                triggered: false,
                frame: frame,
                time: delay,
                blasts: blasts,
                animations: new AnimationList(),
                play: function () {
                    // update canvas
                    state.threading.cache.background?.close?.();
                    state.threading.cache.background = this.frame;
                    this.animations.play();
                    this.triggered = true;
                }
            };
            for (let i = 0; i < blasts.length; i++) {
                const spritesheet = state.blastAnimationFrames.clone();
                const blast = blasts.at(i);
                // sound effects
                const bassNode = config.audio.ctx.newBassNode();
                bassNode.frequency.value = 200;
                const sfxLayer = config.audio.layers.blast.Layer([bassNode], true);
                const sfxNode = config.audio.sources.blast.Instance();
                sfxLayer.add(sfxNode); // [!] whole layer is already ephemeral so no need to apply to the instance
                // visual effects
                spritesheet.width = (blast.radius * 2) * 20;
                const ani = new Animation(blast.position, spritesheet, state.blastAnimationFps);
                ani.speed = 1.25;
                ani.onstart.then(() => {
                    // play sfx
                    bassNode.gain.value = 15 * ((blast.radius / 50)**3);
                    sfxNode.play();
                });
                impact.animations.push(ani);
            }
            state.animations.blast.push(...impact.animations);
            state.impactData.push(impact);
        }
        state.animations.global.push(...state.animations.blast);
        state.blastTerrain = await blastTerrain;
    }
    await state.redrawJob;
    state.landing = landing;
    state.projectile = projectile;
    state.tracer = projectile.tracer;
    muzzleFlash.play();
    config.audio.player.add(config.audio.sources.fire.Instance().play(), true);
}

function generateMuzzleFlash (state, config) { // [!] laziness
    const ss = state.muzzleFlashAnimationFrames.clone();
    ss.width = 400 * (state.aimer.power**3);
    ss.rotation = state.aimer.rotation + Math.PI;
    const ani = new Animation(state.tanks[config.playerTank].barrelPos, ss, state.muzzleFlashAnimationFps);
    ani.speed = 2.3;
    state.animations.global.push(ani);
    return ani;
}

function setTurn (state, toggle) {
    state.isTurn = toggle;
    state.input.pointer.enabled = toggle;
}

function handleInput (state, config) {
    const player = state.tanks[config.playerTank];
    const { keyboard, pointer } = state.input;
    if (keyboard.keyActive("esc")) {
        // pause menu logic
    }
    if (state.isTurn) {
        // [!] most pointer logic handled by callbacks
        if (pointer.isActive) {
            // pointer
            if (pointer.isHolding)
                state.interface.onhold(pointer.position);
        }
        // keyboard
        if (state.projectile === undefined) {
            if (keyboard.keyActive("shootActive"))
                fireProjectile(state.activeShot, state, config);
            else
                for (const [keyMapping, shotType] of Object.entries(state.projectileTypes))
                    if (keyboard.keyActive(keyMapping)) {
                        fireProjectile(shotType, state, config);
                        break;
                    }
        }
        player.position.round(1/GLOBAL_RESOLUTION);
        if (keyboard.keyActive("mv+")) {
            state.move.move(config.moveIncr);
        }
        if (keyboard.keyActive("mv-")) {
            state.move.move(-config.moveIncr);
        }
        if (keyboard.keyActive("shot+")) {
            state.aimer.power+=config.powerIncr;
        }
        if (keyboard.keyActive("shot-")) {
            state.aimer.power-=config.powerIncr;
        }
        if (keyboard.keyActive("aim+")) {
            state.aimer.rotation+=config.aimIncr;
        }
        if (keyboard.keyActive("aim-")) {
            state.aimer.rotation-=config.aimIncr;
        }
    } else {
        // only handle input related to menus (main menu, settings, exit button, etc.) - KT
        if (pointer.isActive) {
            if (pointer.isHolding)
                state.interface
                    .slice(0, 0) // only parse inputs for specific layers with the menu buttons (currently not implemented)
                    .onhold(pointer.position);
        }
    }
}

function drawDebugOverlay (state, config) {
    const { cursor } = config.display;
    const player = state.tanks[config.playerTank];
    // draw any holes in terrain
    for (const hole of state.terrain.holes) {
        cursor.save();
        hole.draw(cursor);
        cursor.strokeStyle = "red";
        cursor.lineWidth = 2;
        cursor.stroke();
        cursor.restore();
    }

    // draw player body and barrel positions
    drawCircle(cursor, player.barrelPos);
    drawCircle(cursor, new Vector(player.position.x, player.position.y), 5,  "green");
    { // draw terrain outline. Draws holes weirdly though
        cursor.save();
        state.terrain.draw(cursor);
        cursor.clip("evenodd"); 
        cursor.strokeStyle = "blue";
        cursor.lineWidth = 4;
        cursor.stroke(); 
        cursor.restore();
    }

    // draw Y-axis positioning raycasters
    const ray = Ray(new Vector(player.position.x, 0), Direction(90), config.display.size.y - 20);
    drawCircle(cursor, ray.at(0), 7, "purple")
    drawCircle(cursor, ray.at(-1), 7, "white")
    state.terrain.raycast(ray)
        .toSorted((a, b) => b.point.y - a.point.y)
        .forEach(({point, angle, entering}, i) => drawMarker(cursor, point, Direction((angle + Math.PI) % (2 * Math.PI), false), 4, 20, entering ? "purple" : "white"));

    if (state.projectile) {
        if (state.landing) {
            // draw blasts, if any
            if (state.landing?.blasts.length) {
                cursor.save();
                cursor.strokeStyle = "orange";
                cursor.lineWidth = 2;
                for (const { shape } of state.landing.blasts) {
                    shape.path.draw(cursor); // [!] inefficient, but for debugging so we don't care?
                }
                cursor.stroke();
                cursor.restore();
            }
            // draw custom properties, if any
            if (state.landing.bounces) {
                const _lineLength = 35;
                state.landing.bounces.forEach(({point, reflection, direction, normal}) => {
                    drawLine(cursor, point, point.add(normal.normalize().mul(_lineLength)), 3, "green"); // normal
                    drawLine(cursor, point, point.add(direction.normalize().mul(_lineLength)), 3, "blue"); // direction (incoming)
                    drawLine(cursor, point, point.add(reflection.normalize().mul(_lineLength)), 3, "red"); // reflection
                });
            }
        }
    }

    [...state.interface].forEach(({items}) => [...items].forEach((item) => {
        if (item?.isButton)
            outlineImage(cursor, item.source, item.position, 1, "green");
    }));

    if (state.input.pointer.isActive) {
        const { position } = state.input.pointer;
        drawCircle(cursor, position, 4, "yellow");
        drawText(cursor, position, position.toString(), "yellow");
        if (state.input.pointer.isDragging && state.aimer.isOver(state.input.pointer.dragStart))
            drawLine(cursor, player.barrelPos, position, 2, "rgba(255, 255, 0, 0.5)");
    }
}

function drawFrame (state, config) {
    const { cursor } = config.display;
    cursor.clear();
    if (state.isTurn) state.interface.draw(cursor, 0, 1);
    for (const tank of Object.values(state.tanks))
        tank.draw(cursor);
    cursor.drawImage(state.threading.cache.background, 0, 0);
    if (state.projectile && state.projectile.time > 0 && state.drawProjectile) state.projectile.draw(cursor);
    if (state.tracer) state.tracer.draw(cursor);
    state.animations.global.update(cursor);
    if (state.isTurn) state.interface.draw(cursor, 1);
}

function animate (state, config) {
    const nowStamp = performance.now();
    const elapsed = nowStamp - state.lastStamp;
    const player = state.tanks[config.playerTank];
    let waitPromise = state.threading.cache.background && !state.redrawJob ? Promise.resolve() : state.redrawJob;

    if (elapsed < config.frameInterval) { // run any between-frame logic
    } else if (state.landing?.intersect && (state.redrawJob?.isWorkerJob && !state.redrawJob.fulfilled)) { // wait for loading to finish before updating game loop
    } else { // redraw frame
        state.lastStamp = nowStamp - (elapsed % config.frameInterval);
        // check if background needs to be updated
        const blastAnimationsFinished = (!state.animations.blast || state.animations.blast.ended);
        if (state.projectile) {
            // trigger blast animations
            for (const impact of state.impactData) {
                if (impact.triggered) continue;
                if (impact.time <= state.projectile.time) impact.play();
            }
            // update projectile
            state.projectile.update(config.traceIncrement, [state.terrain]);
            // are we done with projectile?
            const projectileLanded = state.landing?.time !== undefined;
            const endProjectileEarly =
                (state.projectile.time >= config.traceMaxTime) // time out shots even if a landing exists
                || (!projectileLanded  && 
                    // time out early if theres no landing and it flew offscreen
                    state.projectile.isWithin(config.display.size)
                );
            const isTimedout =
                !(projectileLanded && state.projectile.time >= state.landing.time - Number.EPSILON)
                && endProjectileEarly;
            
            if (endProjectileEarly) {
                if (!blastAnimationsFinished) {
                    // play any paused blast animations prematurely
                    // shouldn't restart already playing animations
                    state.animations.blast?.play();
                }
                if (isTimedout) console.info("Projectile timed out");
                state.projectile = undefined;
            } else if (state.projectile.isStopped && !blastAnimationsFinished) {
                state.drawProjectile = false;
            }
            if ( // [!] could be written better
                state.animations.blast?.ended
                || (!state.animations.blast && isTimedout)
            ) {
                waitPromise = waitPromise
                    .then(() => state.redrawJob)
                    .then(() => {
                        if (state.blastTerrain) state.terrain.apply(state.blastTerrain);
                        // reset projectile related state info
                        state.projectile = state.landing = undefined;
                        state.drawProjectile = true;
                        state.impactData = [];
                        delete state.animations.blast;
                        // update positioning - account for "falling"
                        player.position.round(2);
                        // [!] hack solution
                        state.move.move(0.0001); 
                        state.move.move(-0.0001);
                        // unlock player
                        setTurn(state, true);
                        return (state.redrawJob = Promise.resolve());
                    });
            }
        }
    }
    waitPromise.then(() => {
        // Draw the screen (main game loop - related polygons and images)
        drawFrame(state, config);
        if (DEBUG_ENABLED())
            // [!] testing
            drawDebugOverlay(state, config);
        handleInput(state, config);
        requestAnimationFrame(() => animate(state, config));
    });
}

async function init (...loaded) {
    const [WorkerManager, AudioCtx, AudioPlayer, audioLayers, tankBodyImage, tankBarrelImage, testExplosion, testMuzzleFlash, buttons, sfx] = loaded;
    tankBodyImage.width = 50;
    tankBarrelImage.scale.apply(tankBodyImage.scale);
    {
        const offset = testExplosion.frameSize.mul(testExplosion.scale);
        testExplosion.offset.apply(
            -offset.x * .4, // animation is slightly off center
            offset.y * .6
        );
    }
    {
        testMuzzleFlash.origin.apply(
            testMuzzleFlash.rawSize.x / 2,
            testMuzzleFlash.rawSize.y
        );
    }
    const Workers = new WorkerController(WorkerManager);
    const Display = new AppCanvas(document.getElementById("app"), new Vector(1920, 1080));
    const Tank = new TankController(tankBodyImage, tankBarrelImage, new Vector());
    const Aimer = new AimController(Tank, Tank.width * 3);
    const UIInterface = new Menu.Interface();
    const Inputs = new InputListener(Display.canvas, CLICK_DURATION_MS, INPUT_MAP, UIInterface);
    const Animations = new AnimationList();
    const Terrain = URL_PARAMS.get("map") == "flat"
        ? generateTerrain(new Path(new Vector(0, GROUND), new Vector(Display.size.x, GROUND)).smooth(GLOBAL_RESOLUTION), Display.size)
        : generateTerrain(generateWave(Display.size.x, GLOBAL_RESOLUTION, (v) => v.y += GROUND, .03, 40, 1.3, 15), Display.size);
    const Mover = new MovementController(Terrain, Tank, -(Tank.offset.body.y / 10));

    await Promise.all([
        Workers.createCache("blastBackground", "CANVAS", ...Display.size),
        Workers.createCache("background", "CANVAS", ...Display.size),
        Workers.insertCache("blastTerrain", "POLY", Terrain.Float64(1))
    ]);

    const config = {
        fps: FPS,
        frameInterval: 1000 / FPS,
        display: Display,
        audio: {
            sources: Object.fromEntries(sfx.map((fx) => [fx.name, fx])), // audio sources
            layers: audioLayers,
            player: AudioPlayer,
            ctx: AudioCtx
        },
        playerTank: Tank.id,
        moveIncr: 1,
        aimIncr: (Math.PI / 180),
        powerIncr: .005,
        traceIncrement: 1 / FPS,
        traceMaxTime: MAX_SHOT_TRACE_SECONDS,
        terrain: {
            edge: new Color("#00e8f0"),
            fill: new Color("#0098eb")
        }
    };
    const state = {
        input: Inputs,
        aimer: Aimer,
        move: Mover,
        polygons: {},
        threading: Workers,
        interface: UIInterface,
        isTurn: Inputs.pointer.enabled,
        activeShot: Ammo.BasicShot,
        
        // uncertain about these. will likely refactor out in near future don't implement too much that relies on these
        projectile: undefined,
        tracer: undefined,
        landing: undefined,
        blastTerrain: undefined,
        muzzleFlashAnimationFrames: testMuzzleFlash,
        muzzleFlashAnimationFps: 25,
        blastAnimationFrames: testExplosion,
        blastAnimationFps: 25,
        projectileTypes: {
            shot1: Ammo.BasicShot,
            shot2: Ammo.Spreader,
            shot3: Ammo.Flower,
            shot4: Ammo.Digger,
            shot5: Ammo.Bouncer,
            shot6: Ammo.MegaBouncer,
            shot7: Ammo.GigaBouncer,
            shot8: Ammo.PineShot
        },
        animations: { global: Animations },
        impactData: [],
        drawProjectile: true,


        tanks: {[Tank.id]: Tank},
        terrain: Terrain,
        lastStamp: performance.now(),
        redrawJob: Workers.drawTerrain("background", "blastTerrain", config.terrain.fill, config.terrain.edge)
            .then(() => Workers.updateCache("background"))
    };

    {
        // setup functions that required loaded assets
        Ammo.Bouncer.onBounceCallback = function () {
            config.audio.player.add(config.audio.sources.bouncer.Instance().play(), true);
        }
        Ammo.MegaBouncer.onBounceCallback = function () {
            config.audio.player.add(config.audio.sources.bouncer.Instance().play(), true);
        }
    }

    {
        // setting up UI
        const [fireImage, selectImage, rightImage, leftImage, shotTypeImage] = buttons;
        fireImage.height = 100;
        selectImage.height = 100;
        rightImage.height = 100;
        leftImage.height = 100;
        shotTypeImage.height = 80;
        const fireButton = new Menu.Button(fireImage);
        fireButton.position.apply(75, 150);
        const selectButton = new Menu.Button(selectImage);
        selectButton.position.apply(300, 150);
        const rightButton = new Menu.Button(rightImage);
        rightButton.position.apply(Display.size.x - rightImage.width - 75, 150);
        const leftButton = new Menu.Button(leftImage);
        leftButton.position.apply(rightButton.position.x - leftImage.width - 25, 150);

        const shotTypeIcon = new Menu.Icon(shotTypeImage);
        shotTypeIcon.position.apply(520, 150);
        shotTypeIcon.fontSize = 16;
        shotTypeIcon.text = state.activeShot.name;

        const btns = [fireButton, selectButton, rightButton, leftButton, shotTypeIcon];
        let shotIdx = 0;
        const shotMax = Object.keys(state.projectileTypes).length;
        // setting up button callbacks
        rightButton.onclick = rightButton.onhold = () => Mover.move(config.moveIncr);
        leftButton.onclick = leftButton.onhold = () => Mover.move(-config.moveIncr);
        selectButton.onclick = () => {
            shotIdx = (shotIdx+1)%shotMax;
            state.activeShot = state.projectileTypes[`shot${shotIdx+1}`];
            shotTypeIcon.text = state.activeShot.name;
        };
        fireButton.onclick = () => {
            if (state.projectile === undefined)
                fireProjectile(state.activeShot, state, config);
        }

        UIInterface.insert() // draw layer zero after background but before terrain
            .push(Aimer);
        UIInterface.insert()
            .push(...btns);
    }
    Mover.set(Math.floor(Display.size.x / 4));
    Aimer.update(Tank.position.add({x: 0, y: Display.size.y})); // aim straight up and set power to 100% (1)
    Display.canvas.focus();
    // [!] testing
    if (DEBUG_ENABLED()) {
        window._GAME_STATE = state;
        window._GAME_CONFIG = config;
    }
    if (document.readyState === "complete") {
        animate(state, config);
    } else {
        window.addEventListener("load", () => animate(state, config));
    }
}