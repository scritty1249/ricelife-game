import { InputListener, AppCanvas, WorkerController } from "./controller/controller.js";
import { Vector, Color, Polygon, Ray, Path } from "./geometry/geometry.js";
import { drawCircle, drawMarker, drawLine, drawText, outlineImage } from "./utils/utils.js";
import { drawTerrain, generateTerrain, generateWave } from "./terrain/terrain.js";
import { LoadImage, Spritesheet, Animation, ShapeAnimation, AnimationList } from "./animate/animate.js";
import { WorkerPool } from "./workers/pool.js";
import { AudioContext } from "./audio/audio.js";
import { drawBlastAnimation } from "./projectile/blast.js";
import { PlayerModel, PlayerData, PlayerInstance } from "./player/player.js";
import * as Menu from "./menu/menu.js"
import * as Ammo from "./projectile/ammo-types.js";

const BUSY_SECONDS_THRESHOLD = 1.5; // time in seconds before the "busy" screen pops up while tracing shots
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
    Digit0: "shot10",
    ShiftLeft: "debug+",
    ShiftRight: "debug+"
};

// [!] only for client demo
const LOBBY_DATA = {
    team: 0,
    teams: [ [], [] ],
    terrain: [], // [!] implementing last
}

{
    const defaultHealth = {
        type: "Health",
        increase: 1,
        decrease: 1,
        amount: 100,
        regen: 0,
        max: 100,
        reserve: 0
    };
    const defaultShield = {
        type: "Shield",
        increase: 1,
        decrease: 1,
        amount: 20,
        regen: 20 / 6,
        max: 20,
        reserve: 0
    };
    const defaultHP = [defaultHealth, defaultShield];
    const defaultProfile = {
        name: "Player",
        avatar: "https://cdn.discordapp.com/embed/avatars/0.png?size=64", // "Blurple" avatar
        fontFamily: "serif"
    };


    LOBBY_DATA.teams[0].push({
        profile: defaultProfile,
        hitpoints: defaultHP,
        model: "basic"
    });
    LOBBY_DATA.teams[0].push({
        profile: defaultProfile,
        hitpoints: defaultHP,
        model: "basic"
    });
    LOBBY_DATA.teams[1].push({
        profile: defaultProfile,
        hitpoints: defaultHP,
        model: "basic"
    });
    LOBBY_DATA.teams[1].push({
        profile: defaultProfile,
        hitpoints: defaultHP,
        model: "basic"
    });
    LOBBY_DATA.teams[1].push({
        profile: defaultProfile,
        hitpoints: defaultHP,
        model: "basic"
    });
}

// [!] for debugging
const URL_PARAMS = new URLSearchParams(window?.location?.search);
const DEBUG_ENABLED = () => window?.debugTools || (URL_PARAMS.get("debug") === "true" && window?.debugTools !== false);

export async function load () {
    window.appCanvas.dispatchEvent(new Event("APP_loading"));
    {
        // populate global player model list
        const teams = ["self", "ally", "enemy"];
        const models = ["basic"];
        for (const model of models)
            for (const team of teams)
                PlayerModel.SOURCE_TABLE[`${model}_${team}`] = {
                    body: `./assets/tank/${model}/${team}/body.png`,
                    barrel: `./assets/tank/${model}/${team}/barrel.png`
                }
    }
    // unpack lobby data
    const selfData = PlayerData.fromObject(LOBBY_DATA.teams[LOBBY_DATA.team][0], 0);
    const allyData = Array.from(LOBBY_DATA.teams[LOBBY_DATA.team].slice(1), (data) => PlayerData.fromObject(data, 1));
    const enemyData = Array.from(LOBBY_DATA.teams.filter((_, i) => i !== LOBBY_DATA.team).flat(1), (data) => PlayerData.fromObject(data, -1));
    const playerData = [selfData, ...allyData, ...enemyData];
    const players = playerData.map((data) => new PlayerInstance(data));


    // setup audio
    const AudioCtx = new AudioContext();
    const AudioPlayer = AudioCtx.Layer();
    const audioLayers = {};
    {
        // setting up audio layers
        audioLayers.blast = AudioPlayer.Layer();
        audioLayers.blast.volume = .55;
        // setting global audio
        AudioPlayer.volume = 0.35;
    }
    // bundle for passing
    const audio = { AudioCtx, AudioPlayer, audioLayers };
    const buttons = {
        fire: new LoadImage("./assets/interface/buttons/fire.png"),
        select: new LoadImage("./assets/interface/buttons/select.png"),
        right: new LoadImage("./assets/interface/buttons/right.png"),
        left: new LoadImage("./assets/interface/buttons/left.png"),
        shotType: new LoadImage("./assets/interface/buttons/shot-type.png")
    }
    const vfx = {
        muzzleFlash: new Spritesheet("./assets/blast/muzzleflash_ss_140x162.png", 140, 162, 25),
        blast: {
            draw: drawBlastAnimation,
            framerate: 25
        }
    };
    const sfx = {
        fire: AudioCtx.Source("fire", "./assets/sfx/fire.mp3"),
        blast: AudioCtx.Source("blast", "./assets/sfx/blast.mp3"),
        bouncer: AudioCtx.Source("bouncer", "./assets/sfx/bouncer-collision.wav")
    }
    const WorkerManager = new WorkerPool(new URL(`./workers/web-worker.js`, import.meta.url), 4, 3);
    await Promise.all([
        WorkerManager.initPromise
            .catch(() => console.error("[Main] Error: WorkerPool size is zero")),
        ...Object.values(vfx).map((fx) => fx.onload),
        ...Object.values(sfx).map((fx) => fx.onload),
        ...Object.values(buttons).map((btn) => btn.onload),
        ...playerData.map((p) => p.onload)
    ]);

    {
        // apply vfx offsets
        vfx.muzzleFlash.origin.apply(
            vfx.muzzleFlash.rawSize.x / 2,
            vfx.muzzleFlash.rawSize.y
        );
    }

    init(WorkerManager, audio, players, buttons, vfx, sfx);
}


// WorkerManager, audio, await playerData, await buttons, await vfx, await sfx
async function init (...loaded) {
    const [ WorkerManager, {AudioCtx, AudioPlayer, audioLayers}, players, buttons, vfx, sfx ] = loaded;
    const Workers = new WorkerController(WorkerManager);
    const Display = new AppCanvas(window.appCanvas, new Vector(1920, 1080));
    const UIInterface = new Menu.Interface();
    const Inputs = new InputListener(Display.canvas, CLICK_DURATION_MS, INPUT_MAP, UIInterface);
    const Animations = new AnimationList();
    const Terrain = URL_PARAMS.get("map") == "flat"
        ? generateTerrain(new Path(new Vector(0, GROUND), new Vector(Display.size.x, GROUND)).smooth(GLOBAL_RESOLUTION), Display.size)
        : generateTerrain(generateWave(Display.size.x, GLOBAL_RESOLUTION, (v) => v.y += GROUND, .03, 40, 1.3, 15), Display.size);

    await Promise.all([
        Workers.createCache("blastBackground", "CANVAS", ...Display.size),
        Workers.createCache("background", "CANVAS", ...Display.size),
        Workers.insertCache("blastTerrain", "POLY", Terrain.Float64(1)),
        ...players.map((p) => p.load(Terrain))
    ]);
    console.info("[Main]: Worker caches initalized");
    let state, config;

    config = {
        busyThreshold: 1000 * BUSY_SECONDS_THRESHOLD,
        fps: FPS,
        frameInterval: 1000 / FPS,
        display: Display,
        audio: {
            sources: sfx, // audio sources
            layers: audioLayers,
            player: AudioPlayer,
            ctx: AudioCtx
        },
        animated: vfx,
        dispatchEvent: {
            ready: function () {
                window.appCanvas.dispatchEvent(new Event("APP_ready"));
            },
            busy: function () {
                window.appCanvas.dispatchEvent(new Event("APP_busy"));
            },
            error: function () {
                if (state.dispatchBusyTimeout !== undefined) clearTimeout(state.dispatchBusyTimeout);
                window.appCanvas.dispatchEvent(new Event("APP_error"));
            }
        },
        player: players[0],
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
    state = {
        dispatchBusyTimeout: undefined,
        input: Inputs,
        polygons: {},
        threading: Workers,
        interface: UIInterface,
        isTurn: Inputs.pointer.enabled,
        activeShot: Ammo.BasicShot,
        debug: {}, // [!] store debugging related stuff here
        
        // uncertain about these. will likely refactor out in near future don't implement too much that relies on these
        projectile: undefined,
        tracer: undefined,
        landing: undefined,
        blastTerrain: undefined,
        projectileTypes: {
            shot1: Ammo.BasicShot,
            shot2: Ammo.Spreader,
            shot3: Ammo.Flower,
            shot4: Ammo.Digger,
            shot5: Ammo.Bouncer,
            shot6: Ammo.MegaBouncer,
            shot7: Ammo.GigaBouncer,
            shot8: Ammo.PineShot,
            shot9: Ammo.Sniper
        },
        animations: { global: Animations },
        impactData: [],
        drawProjectile: true,


        players: Object.fromEntries(Array.from(players, (p) => [p.id, p])),
        terrain: Terrain,
        lastStamp: performance.now(),
        redrawJob: Workers.drawTerrain("background", "blastTerrain", config.terrain.fill, config.terrain.edge)
            .then(() => Workers.updateCache("background"))
    };

    {
        // setup functions that required loaded assets
        const bounceSfxFn = function () { config.audio.player.add(config.audio.sources.bouncer.Instance().play(), true); }
        Ammo.Bouncer.SFX.bounce = bounceSfxFn;
        Ammo.MegaBouncer.SFX.bounce = bounceSfxFn;
    }

    {
        // setting up UI
        const { fire: fireImage, select: selectImage, right: rightImage, left: leftImage, shotType: shotTypeImage } = buttons;
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
        rightButton.onclick = rightButton.onhold = () => config.player.mover.move(config.moveIncr);
        leftButton.onclick = leftButton.onhold = () => config.player.mover.move(-config.moveIncr);
        selectButton.onclick = () => {
            shotIdx = (shotIdx+1)%shotMax;
            state.activeShot = state.projectileTypes[`shot${shotIdx+1}`];
            shotTypeIcon.text = state.activeShot.name;
        };
        fireButton.onclick = () => {
            if (state.projectile === undefined)
                fireProjectile(state.activeShot, state, config)
                    .catch((error) => {
                        console.error("[Main]: Projectile trace error");
                        config.dispatchEvent.error();
                        throw error;
                    });
        }

        UIInterface.insert() // draw layer zero after background but before terrain
            .push(players[0].aimer);
        UIInterface.insert()
            .push(...btns);
    }

    {
        // distribute players
        const min = Display.size.x / 10;
        const max = Display.size.x - min;
        const spacing = (Display.size.x / 6);
        const range = (max - min) / spacing; 
        const spots = new Set()
        let x = undefined;
        for (const { aimer, mover } of players) {
            while (x === undefined || spots.has(x)) {
                x = (Math.floor(Math.random() * (range + 1)) * spacing) + min;
            }
            spots.add(x);
            mover.set(x);
            aimer.update(players[0].tank.position.add({x: 0, y: Display.size.y})); // aim straight up and set power to 100% (1)
        }
    }
    Display.canvas.focus();
    // [!] testing
    if (DEBUG_ENABLED()) {
        window._GAME_STATE = state;
        window._GAME_CONFIG = config;
    }
    window.appCanvas.dispatchEvent(new Event("APP_ready"));
    if (document.readyState === "complete") {
        animate(state, config);
    } else {
        window.addEventListener("load", () => animate(state, config));
    }
}

async function fireProjectile (shot, state, config) { // [!} laziness
    setTurn(state, false);
    const player = config.player;
    let wasSetBusy = false;
    state.dispatchBusyTimeout = setTimeout(() => {
        wasSetBusy = true;
        config.dispatchEvent.busy();
    }, config.busyThreshold);

    drawFrame(state, config); // draw one last frame so the game doesn't look like it just froze
    const launchOrigin = state.terrain.isIntersecting(player.tank.barrelPos)
        ? player.tank.relativePosition
        : player.tank.barrelPos;
    const projectile = new shot(launchOrigin, player.aimer.rotation + (3 * (Math.PI / 2)), player.aimer.power);
    projectile.colliders.push(state.terrain);
    const muzzleFlash = generateMuzzleFlash(state, config);
    const landing = await state.threading.traceProjectile("blastTerrain", projectile, config.traceIncrement, config.traceMaxTime);
    projectile.setLegend(landing.legend);
    state.blastTerrain = undefined;
    state.impactData = [];
    if (state.debug) {
        state.debug.landing = landing;
        state.debug.legend = projectile.getLegend(false);
        state.debug.collisions = [];
        for (const multiStageLegend of state.debug.legend)
            for (const stageLegend of multiStageLegend)
                for (const collision of stageLegend.collisions)
                    state.debug.collisions.push(collision);
    }
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
                const blast = blasts.at(i);
                const blastSize = blast.shape.getBoundingBox().size.length;
                // sound effects
                const bassNode = config.audio.ctx.newBassNode();
                bassNode.frequency.value = 200;
                const sfxLayer = config.audio.layers.blast.Layer([bassNode], true);
                const sfxNode = config.audio.sources.blast.Instance();
                sfxLayer.add(sfxNode); // [!] whole layer is already ephemeral so no need to apply to the instance
                // visual effects
                const ani = new ShapeAnimation(blast.shape.clone(), .6, config.animated.blast.framerate, config.animated.blast.draw);
                ani.speed = 1.25;
                ani.onstart.then(() => {
                    // play sfx
                    bassNode.gain.value = (blastSize / 50)**3;
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
    state.tracer = projectile.getTracer();
    if (wasSetBusy) {
        config.dispatchEvent.ready();
    } else {
        clearTimeout(state.dispatchBusyTimeout);
    }
    muzzleFlash.play();
    config.audio.player.add(config.audio.sources.fire.Instance().play(), true);
}

function generateMuzzleFlash (state, config) { // [!] laziness
    const player = config.player;
    const ss = config.animated.muzzleFlash.clone();
    ss.width = 600 * (player.aimer.power**3);
    ss.rotation = player.aimer.rotation + Math.PI;
    const ani = new Animation(player.tank.barrelPos, ss, ss.framerate);
    ani.speed = 2.3;
    state.animations.global.push(ani);
    return ani;
}

function setTurn (state, toggle) {
    state.isTurn = toggle;
    state.input.pointer.enabled = toggle;
}

function handleInput (state, config) {
    const player = config.player;
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
        if (!keyboard.keyActive("debug+")) {
            if (state.projectile === undefined) {
                if (keyboard.keyActive("shootActive"))
                    fireProjectile(state.activeShot, state, config);
                else
                    for (const [keyMapping, shotType] of Object.entries(state.projectileTypes))
                        if (keyboard.keyActive(keyMapping)) {
                            fireProjectile(shotType, state, config)
                                .catch((error) => {
                                    console.error("[Main]: Projectile trace error");
                                    config.dispatchEvent.error();
                                    throw error;
                                });
                            break;
                        }
            }
            player.tank.position.round(1/GLOBAL_RESOLUTION);
            if (keyboard.keyActive("mv+")) {
                player.mover.move(config.moveIncr);
            }
            if (keyboard.keyActive("mv-")) {
                player.mover.move(-config.moveIncr);
            }
            if (keyboard.keyActive("shot+")) {
                player.aimer.power+=config.powerIncr;
            }
            if (keyboard.keyActive("shot-")) {
                player.aimer.power-=config.powerIncr;
            }
            if (keyboard.keyActive("aim+")) {
                player.aimer.rotation+=config.aimIncr;
            }
            if (keyboard.keyActive("aim-")) {
                player.aimer.rotation-=config.aimIncr;
            }
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
    const { debug } = state;
    const player = config.player;
    if (!debug) return; // [!] debug property should always exist (but may be empty)
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
    drawCircle(cursor, player.tank.barrelPos);
    drawCircle(cursor, new Vector(player.tank.position.x, player.tank.position.y), 5,  "green");
    { // draw terrain outline. Draws holes weirdly though
        cursor.save();
        state.terrain.draw(cursor);
        cursor.clip("evenodd"); 
        cursor.strokeStyle = "blue";
        cursor.lineWidth = 4;
        cursor.stroke(); 
        cursor.restore();
    }
    {
        // draw Y-axis positioning raycasters
        const ray = Ray(new Vector(player.tank.position.x, 0), Vector.fromAngle(Math.PI/2), config.display.size.y - 20);
        drawCircle(cursor, ray.at(0), 7, "purple")
        drawCircle(cursor, ray.at(-1), 7, "white")
        state.terrain.raycast(ray)
            .toSorted((a, b) => b.point.y - a.point.y)
            .forEach(({point, angle, entering}, i) => drawMarker(cursor, point, Vector.fromAngle(angle + Math.PI), 4, 20, entering ? "purple" : "white"));
    }

    if (state.projectile) {
 
    }
    if (debug.landing) {
        // draw collision details
        if (debug.collisions) {
            const _lineLength = 35;
            const red = new Color(255, 0, 0, .5)
                .toString();
            const green = new Color(0, 255, 0, .5)
                .toString();
            const blue = new Color(0, 0, 255, .5)
                .toString();
            debug.collisions.forEach(({position, point, resultVelocity, velocity, normal}) => {
                drawCircle(cursor, position, 3, blue); // shot position during collision
                drawLine(cursor, point, point.add(normal.normalize().mul(_lineLength)), 2, green); // normal
                drawLine(cursor, point, point.add(velocity.normalize().mul(_lineLength)), 2, blue); // direction (incoming)
                drawLine(cursor, position, position.add(resultVelocity.normalize().mul(_lineLength)), 2, red); // reflection
            });
        }
        // draw blasts
        if (debug.landing?.blasts?.length) {
            const c = new Color(255, 165, 0, .15);
            cursor.save();
            cursor.fillStyle = c.toString();
            for (const { shape } of debug.landing.blasts) {
                shape.draw(cursor, true);
                cursor.fill();
            }
            cursor.restore();
            c.a = 1;
            for (const { position } of debug.landing.blasts) {
                drawCircle(cursor, position, 3, c.toString());
            }
        }
    }

    [...state.interface].forEach(({items}) => [...items].forEach((item) => {
        if (item?.isButton)
            outlineImage(cursor, item.source, item.position, 1, "green");
    }));

    if ((state.input.pointer.isDragging
        && player.aimer.isOver(state.input.pointer.dragStart))
        || state.input.keyboard.keyActive("debug+")
    ) {
        const { position } = state.input.pointer;
        const c = state.terrain.isIntersecting(position) ? new Color(0, 200, 50, 1) : new Color(200, 200, 10, 1);
        drawCircle(cursor, position, 4, c);
        drawText(cursor, position, position.toString(), c.toString());
        c.a = .5;
        drawLine(cursor, player.tank.barrelPos, position, 2, c.toString());
    }
    if (state.input.keyboard.keyActive("debug+")) {
        const { position } = state.input.pointer;
        // stuff here may cause a lot of lag
        // draw raycast tester
        const mode = state.input.keyboard.keyActive("shot1")
            ? 1 // only show hits from holes
            : state.input.keyboard.keyActive("shot2")
                ? 2 // only show hits from non-holes
                : 0; // show all hits
        const hits = state.terrain.raycast(Ray(player.tank.barrelPos, position))
            .filter(({hole}) => 
                (mode === 0)
                || (mode === 1 && hole)
                || (mode === 2 && !hole));
        if (state.input.keyboard.keyActive("shot3")) console.log(hits);
        cursor.save();
        cursor.strokeStyle = "orange";
        cursor.lineWidth = 3;
        for (let i = 0; i < hits.length; i++) {
            const { point, angle, entering, hole } = hits[i];
            const c = entering ? "purple" : "white";
            const offset = point.x > position.x
                ? (3 * Math.PI) / 2
                : Math.PI / 2;
            drawMarker(cursor, point, Vector.fromAngle(angle + offset), 4, 20, c);
            hits[i]._path.draw(cursor, true);
            cursor.stroke();
        }
        cursor.restore();
    }
}

function drawFrame (state, config) {
    const { cursor } = config.display;
    cursor.clear();
    if (state.isTurn) state.interface.draw(cursor, 0, 1);
    for (const { tank } of Object.values(state.players))
        tank.draw(cursor);
    cursor.drawImage(state.threading.cache.background, 0, 0);
    if (state.tracer) state.tracer.draw(cursor);
    if (state.projectile && state.projectile.time > 0 && state.drawProjectile) state.projectile.draw(cursor);
    state.animations.global.update(cursor);
    for (const { data, tank } of Object.values(state.players))
        if (data.team !== 0) data.profile.draw(cursor, tank.relativePosition);
    if (state.isTurn) state.interface.draw(cursor, 1);
}

function animate (state, config) {
    const nowStamp = performance.now();
    const elapsed = nowStamp - state.lastStamp;
    const player = config.player;
    let waitPromise = state.threading.cache.background && !state.redrawJob ? Promise.resolve() : state.redrawJob;

    if (elapsed < config.frameInterval) { // run any between-frame logic
    } else if (state.landing?.intersect && (state.redrawJob?.isWorkerJob && !state.redrawJob.fulfilled)) { // wait for loading to finish before updating game loop
        console.log(true);
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
            const endProjectileEarly =
                (state.projectile.time >= config.traceMaxTime) // time out shots even if a landing exists
                || (!state.landing.finished
                    // time out early if theres no landing and it flew offscreen
                    && !state.projectile.getBoundingBox().isIntersecting(config.display.getBoundingBox())
                );
            const isTimedout =
                !(state.landing.finished && state.projectile.time >= state.landing.time - Number.EPSILON)
                && endProjectileEarly;

            if (endProjectileEarly) {
                if (!blastAnimationsFinished) {
                    // play any paused blast animations prematurely
                    // shouldn't restart already playing animations
                    state.animations.blast?.play();
                }
                if (isTimedout) console.info("[Main]: Projectile timed out");
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
                        // [!] debugging
                        if (!state.blastTerrain) return;
                        const hash = state.blastTerrain.hash;
                        state.threading.hashCache("blastTerrain")
                            .then((h) => {
                                if (hash !== h)
                                    console.error(`[Main]: Cached terrain does not match current terrain state. Terrain drawn onscreen may not reflect it's hitbox.`)
                            });
                    })
                    .then(() => {
                        if (state.blastTerrain) state.terrain.apply(state.blastTerrain);
                        // reset projectile related state info
                        state.projectile = state.landing = undefined;
                        state.drawProjectile = true;
                        state.impactData = [];
                        delete state.animations.blast;
                        for (const { tank, mover } of Object.values(state.players)) {
                            // update positioning - account for "falling"
                            tank.position.round(2);
                            // [!] hack solution
                            mover.move(0.0001); 
                            mover.move(-0.0001);
                        }
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
    }).catch((error) => {
        console.error("Animation loop error");
        config.dispatchEvent.error();
        throw error;
    });
}
