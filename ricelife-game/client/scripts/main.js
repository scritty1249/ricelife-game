import { InputListener, MovementController, TankController, AppCanvas, AimController, WorkerController } from "./controller/controller.js";
import { Vector, Direction, Color, Polygon, Ray, Path } from "./geometry/geometry.js";
import { drawCircle, drawMarker, drawLine, rad2deg, roundTo, floatEqual, normalizeAngle, drawText, outlineImage } from "./utils/utils.js";
import { drawTerrain, generateTerrain, generateWave } from "./terrain/terrain.js";
import { LoadImage, Spritesheet, Animation, AnimationList } from "./animate/animate.js";
import { WorkerPool } from "./workers/pool.js";
import { AudioContext } from "./audio/audio.js";
import * as Menu from "./menu/menu.js"
import * as Projectiles from "./projectile/projectile.js";

// [!] for debugging
const URL_PARAMS = new URLSearchParams(window?.location?.search);
const DEBUG_ENABLED = () => window?.debugTools || (URL_PARAMS.get("debug") === "true" && window?.debugTools !== false);

async function fireProjectile (shot, state, config) { // [!} laziness
    setTurn(state, false);
    drawFrame(state, config); // draw one last frame so the game doesn't look like it just froze
    const projectile = new shot(state.tanks[config.playerTank].barrelPos, state.aimer.rotation + (3 * (Math.PI / 2)), state.aimer.power);
    const muzzleFlash = generateMuzzleFlash(state, config);
    const landing = await state.threading.traceProjectile("blastTerrain", projectile, config.traceIncrement, config.traceLimit);
    state.blastTerrain = undefined;
    if (landing.intersect) {
        const blastRadius = projectile.blastRadius;
        const blasts = projectile.blast.blastsAt(landing.point); // should be sorted
        const blastDelays = projectile.blast.delay;
        state.redrawJob = state.threading.drawBlastedTerrains(1, "blastTerrain", config.display.size, config.terrain, ...blasts);
        await state.redrawJob;
        const { frames: blastedTerrainFrames, polygon: blastTerrain } = await state.redrawJob;
        state.animations.blast = new AnimationList();
        const ss = state.blastAnimationFrames.clone();
        ss.width = (blastRadius * 2) * 20;
        for (let i = 0; i < blasts.length; i++) {
            const frame = blastedTerrainFrames.at(i);
            const { shape, delay } = blasts[i];
            const ani = new Animation(shape.position, ss, state.blastAnimationFps);
            ani.speed = 1.25;
            ani.delay = delay * ani.speed;
            ani.onstart.then(() => {
                // update canvas
                state.threading.cache.background?.close?.();
                state.threading.cache.background = frame;
                // play sfx
                config.audio.add(config.sfx.blast.Instance().play(), true);
            });
            state.animations.blast.push(ani);
        }
        state.animations.global.push(...state.animations.blast);
        state.blastTerrain = await blastTerrain;
    }
    await state.redrawJob;
    state.landing = landing;
    state.projectile = projectile;
    state.tracer = projectile.tracer;
    muzzleFlash.play();
    config.audio.add(config.sfx.fire.Instance().play(), true);
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
        // draw blast radius while in flight
        cursor.save();
        cursor.strokeStyle = "orange";
        cursor.lineWidth = 2;
        for (const { shape } of state.projectile.blast.blastsAt(state.projectile.position))
            shape.path.draw(cursor);
        if (state.landing?.intersect)
            for (const { shape } of state.projectile.blast.blastsAt(state.landing.point))
                shape.path.draw(cursor);
        cursor.stroke(); 
        cursor.restore();
        if (state.landing) {
            // draw landing point, if exists
            if (state.landing?.intersect) {
                drawCircle(cursor, state.landing.point, state.projectile.radius, "orange");
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
    if (state.projectile && state.projectile.time > 0) state.projectile.draw(cursor);
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
        if (state.projectile) {
            const endProjectileEarly =
                (state.projectile.time >= config.traceMaxTime) // time out shots even if a landing exists
                || state.projectile.isColliding // safety/sanity check
                || (!state.landing?.intersect && (
                    // time out early if theres no landing and it flew offscreen
                    state.projectile.current.position.x > config.display.size.x
                    || state.projectile.current.position.x < 0
                    || state.projectile.current.position.y > config.display.size.y
                    || state.projectile.current.position.y < 0
                ));
            const isTimedout =
                !(state.landing?.intersect && state.projectile.time >= state.landing.at - Number.EPSILON)
                && endProjectileEarly;
            if (
                (state.landing?.intersect && state.projectile.time >= state.landing.at - Number.EPSILON)
                || endProjectileEarly
            ) {
                if (isTimedout) {
                    // timed out
                    console.info("Projectile timed out early");
                }
                // projectile landed, redraw terrain
                state.projectile = state.landing = undefined;
                state.redrawJob.then(() => { if (state.blastTerrain) state.terrain.apply(state.blastTerrain) });

                const animationJob = state.redrawJob.then(() => {
                        (state.animations.blast?.play()?.onend || Promise.resolve())
                            .then(() => setTurn(state, true));
                        delete state.animations.blast;
                        return;
                    });
                const positionJob = state.redrawJob.then(() => {
                        player.position.round(2);
                        if (state.terrain.holes.some((hole) => hole.isIntersecting(player.position))) // shallow check
                            state.move.set(player.position.x); // update positioning - account for "falling"
                        return;
                    });
                waitPromise = waitPromise
                    .then(() => Promise.all([animationJob, positionJob]))
                    .then(() => state.redrawJob = Promise.resolve());
            } else {
                state.projectile.update(1 / config.fps, [state.terrain]);
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

async function load() {
    const body = new LoadImage("./assets/tank/body.png").onload;
    const barrel = new LoadImage("./assets/tank/barrel.png").onload;
    const testExplosion = new Spritesheet("./assets/blast/explosion_ss_512x512.png", 512, 512).onload;
    const testMuzzleFlash = new Spritesheet("./assets/blast/muzzleflash_ss_140x162.png", 140, 162).onload;
    const AudioCtx = new AudioContext();
    const AudioPlayer = AudioCtx.Layer();
    // resume audio context on inputs
    window.addEventListener("pointermove", AudioCtx.wake);
    window.addEventListener("pointerdown", AudioCtx.wake);
    window.addEventListener("pointerup", AudioCtx.wake);
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
    main(WorkerManager, AudioPlayer, await body, await barrel, await testExplosion, await testMuzzleFlash, await buttons, await sfx);
}

const MAX_SHOT_TRACE_SECONDS = 15; // will trigger a landing early if timeout is exceeded- however a landing will only be traced within this time frame so early landings shouldn't be happening... -KT
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

async function main(...loaded) {
    const [WorkerManager, AudioPlayer, tankBodyImage, tankBarrelImage, testExplosion, testMuzzleFlash, buttons, sfx] = loaded;
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
        audio: AudioPlayer,
        sfx: Object.fromEntries(sfx.map((fx) => [fx.name, fx])), // audio sources
        playerTank: Tank.id,
        moveIncr: 1,
        aimIncr: (Math.PI / 180),
        powerIncr: .005,
        traceIncrement: 1 / FPS,
        traceMaxTime: MAX_SHOT_TRACE_SECONDS,
        traceLimit: MAX_SHOT_TRACE_SECONDS * FPS,
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
        activeShot: Projectiles.BasicShot,
        
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
            shot1: Projectiles.BasicShot,
            shot2: Projectiles.Spreader,
            shot3: Projectiles.Flower,
            shot4: Projectiles.Digger,
            shot5: Projectiles.Bouncer
        },
        animations: { global: Animations },


        tanks: {[Tank.id]: Tank},
        terrain: Terrain,
        lastStamp: performance.now(),
        redrawJob: Workers.drawTerrain("background", "blastTerrain", config.terrain.fill, config.terrain.edge)
            .then(() => Workers.updateCache("background"))
    };

    {
        // setup functions that required loaded assets
        Projectiles.Bouncer.onBounceCallback = function () {
            config.audio.add(config.sfx.bouncer.Instance().play(), true);
        }
    }

    {
        // setting up UI
        const [fireImage, selectImage, rightImage, leftImage, shotTypeImage] = buttons;
        fireImage.height = 100;
        selectImage.height = 100;
        rightImage.height = 100;
        leftImage.height = 100;
        shotTypeImage.height = 75;
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
        shotTypeIcon.text = "1";

        const btns = [fireButton, selectButton, rightButton, leftButton, shotTypeIcon];
        let shotIdx = 0;
        const shotMax = Object.keys(state.projectileTypes).length;
        // setting up button callbacks
        rightButton.onclick = rightButton.onhold = () => Mover.move(config.moveIncr);
        leftButton.onclick = leftButton.onhold = () => Mover.move(-config.moveIncr);
        selectButton.onclick = () => {
            shotIdx = (shotIdx+1)%shotMax;
            shotTypeIcon.text = shotIdx + 1;
            state.activeShot = state.projectileTypes[`shot${shotIdx+1}`];
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

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", load);
} else {
    load();
}
