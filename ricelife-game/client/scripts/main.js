import { InputListener, MovementController, TankController, AppCanvas, AimController } from "./controller/controller.js";
import { Vector, Direction, Color, Polygon, GeometryWorker, Ray, Path } from "./geometry/geometry.js";
import { drawCircle, drawMarker, drawLine, rad2deg, roundTo, floatEqual, normalizeAngle, drawText, outlineImage } from "./utils/utils.js";
import { drawTerrain, generateTerrain, generateWave } from "./terrain/terrain.js";
import { LoadImage, Spritesheet, Animation, AnimationList } from "./animate/animate.js";
import * as Menu from "./menu/menu.js"
import * as Projectiles from "./projectile/projectile.js";

// [!] for debugging
const URL_PARAMS = new URLSearchParams(window?.location?.search);
const DEBUG_ENABLED = () => window?.debugTools || (URL_PARAMS.get("debug") === "true" && window?.debugTools !== false);

async function fireProjectile (shot, state, config) { // [!} laziness
    setTurn(state, false);
    drawFrame(state, config); // draw one last frame so the game doesn't look like it just froze
    state.projectile = new shot(state.tanks[config.playerTank].barrelPos, state.aimer.rotation + (3 * (Math.PI / 2)), state.aimer.power);
    state.tracer = state.projectile.tracer;
    state.blastTerrain = state.terrain.clone();
    state.landing = state.projectile.intersectAt(state.blastTerrain, 1/config.fps, config.fps * 2 * 60); // [!] for testing
    if (state.landing) {
        const shotConfig = state.projectile.config;
        const blasts = state.projectile.blast.shapesAt(state.landing.point);
        const blastDelays = state.projectile.blast.delay;
        state.redrawJob = state.geometry.cut("blastTerrain", state.terrain, ...blasts)
            .then((polygon) => state.blastTerrain.apply(polygon))
            .then((polygon) => config.display.drawTerrain("blastBackground", state.blastTerrain, config.terrain.fill, config.terrain.edge))
            // [!] temporary
            .then(() => {
                // return the blast animation
                const aniList = new AnimationList();
                const ss = state.blastAnimationFrames.clone();
                ss.width = (shotConfig.blastRadius * 2) * 20;
                for (let i = 0; i < blasts.length; i++) {
                    const blast = blasts[i];
                    const delay = i < blastDelays.length ? blastDelays[i] : 0;
                    const ani = new Animation(blast.position, ss, state.blastAnimationFps);
                    ani.speed = 1.25;
                    ani.delay = delay * ani.speed;
                    aniList.push(ani);
                }
                aniList.pause();
                state.animations.push(...aniList);
                return aniList;
            });
    }
    {
        // play muzzle flash
        const ss = state.muzzleFlashAnimationFrames.clone();
        ss.width = 400 * (state.aimer.power**3);
        ss.rotation = state.aimer.rotation + Math.PI;
        const ani = new Animation(state.tanks[config.playerTank].barrelPos, ss, state.muzzleFlashAnimationFps);
        ani.speed = 2.3;
        ani.play();
        state.animations.push(ani);
    }
}

function setTurn (state, toggle) {
    state.isTurn = toggle;
    state.input.pointer.enabled = toggle;
}

function handleInput (state, config) {
    const player = state.tanks[config.playerTank];
    const { keyboard, pointer } = state.input;
    if (keyboard.keyActive("esc")) {

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
        for (const shape of state.projectile.blast.shapes)
            shape.path.draw(cursor);
        cursor.stroke(); 
        cursor.restore();
        if (state.landing) drawCircle(cursor, state.landing.point, state.projectile.config.radius, "orange"); // draw landing point
    } else state.landing = undefined;

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
    cursor.drawImage(config.display.worker.cache.background.image, 0, 0);
    if (state.projectile) {
        state.projectile.draw(cursor);
        if (state.projectile.isProjectile) {
            state.projectile.update(1 / config.fps);
        } else state.projectile = false;
    }
    if (state.tracer) state.tracer.draw(cursor);
    state.animations.update(cursor);
    if (state.isTurn) state.interface.draw(cursor, 1);
}

function animate (state, config) {
    const nowStamp = performance.now();
    const elapsed = nowStamp - state.lastStamp;
    const player = state.tanks[config.playerTank];
    let waitPromise = config.display.worker.cache.background ? Promise.resolve() : state.redrawJob;
    
    if (elapsed < config.frameInterval) { // run any between-frame logic
    } else { // redraw frame
        state.lastStamp = nowStamp - (elapsed % config.frameInterval);
        // check if background needs to be updated
        if (state.projectile) {
            if (state.terrain.isIntersecting(state.projectile.shape)) {
                state.projectile = false; // set to false to flag background cache for redraw
            }
        }
        if (state.projectile === false) {
            state.projectile = undefined;
            waitPromise = state.redrawJob
                .then((animation) => (animation.play()
                    .onend.then(() => setTurn(state, true)), null))
                .then(() => config.display.copyCanvas("background", config.display.worker.cache.blastBackground.image))
                .then(() => state.terrain.apply(state.blastTerrain))
                .then(() => {
                    player.position.round(2);
                    if (state.terrain.holes.some((hole) => hole.isIntersecting(player.position))) // shallow check
                        state.move.set(player.position.x); // update positioning - account for "falling"
                });
        }
        waitPromise = waitPromise.then(() => {
            // Draw the screen (main game loop - related polygons and images)
            drawFrame(state, config);
            if (DEBUG_ENABLED())
                // [!] testing
                drawDebugOverlay(state, config);
        });
    }
    waitPromise.then(() => {
        handleInput(state, config);
        requestAnimationFrame(() => animate(state, config));
    });
}

async function load() {
    const body = await new LoadImage("./assets/tank/body.png").onload;
    const barrel = await new LoadImage("./assets/tank/barrel.png").onload;
    const testExplosion = await new Spritesheet("./assets/blast/explosion_ss_512x512.png", 512, 512).onload;
    const testMuzzleFlash = await new Spritesheet("./assets/blast/muzzleflash_ss_1626x1882.png", 1626, 1882).onload;
    const buttons = await Promise.all([
        new LoadImage("./assets/interface/buttons/fire.png").onload,
        new LoadImage("./assets/interface/buttons/select.png").onload,
        new LoadImage("./assets/interface/buttons/right.png").onload,
        new LoadImage("./assets/interface/buttons/left.png").onload
    ]);
    main(body, barrel, testExplosion, testMuzzleFlash, buttons);
}

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
    Space: "shot1",
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
const POINTER_CALLBACKS = (aimCtrl) => ({
    ondrag: (current, origin) => { if (aimCtrl.isOver(origin)) aimCtrl.update(current) },
    onclick: (current) => { if (aimCtrl.isOver(current)) aimCtrl.update(current) }
});

function main(...loaded) {
    const [tankBodyImage, tankBarrelImage, testExplosion, testMuzzleFlash, buttons] = loaded;
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

    const Display = new AppCanvas(document.getElementById("app"), new Vector(1920, 1080));
    const Tank = new TankController(tankBodyImage, tankBarrelImage, new Vector());
    const Aimer = new AimController(Tank, Tank.width * 3);
    // [!] testing
    const Terrain = URL_PARAMS.get("map") == "flat"
        ? generateTerrain(new Path(new Vector(0, GROUND), new Vector(Display.size.x, GROUND)).smooth(GLOBAL_RESOLUTION), Display.size)
        : generateTerrain(generateWave(Display.size.x, GLOBAL_RESOLUTION, (v) => v.y += GROUND, .03, 40, 1.3, 15), Display.size);
    const Mover = new MovementController(Terrain, Tank, -(Tank.offset.body.y / 10));
    const UIInterface = new Menu.Interface();
    const Inputs = new InputListener(Display.canvas, CLICK_DURATION_MS, INPUT_MAP, UIInterface);
    Display.createCache("blastBackground");
    Display.createCache("background");
    // [!] testing
    const Animations = new AnimationList();

    const config = {
        fps: FPS,
        frameInterval: 1000 / FPS,
        display: Display,
        playerTank: Tank.id,
        moveIncr: 1,
        aimIncr: (Math.PI / 180),
        powerIncr: .005,
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
        geometry: new GeometryWorker(),
        interface: UIInterface,
        isTurn: Inputs.pointer.enabled,
        
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
            shot4: Projectiles.Digger
        },
        animations: Animations,

        tanks: {[Tank.id]: Tank},
        terrain: Terrain,
        lastStamp: performance.now(),
        redrawJob: Display.drawTerrain("background", Terrain, config.terrain.fill, config.terrain.edge)
    };

    {
        // setting up UI
        const [fireImage, selectImage, rightImage, leftImage] = buttons;
        fireImage.height = 100;
        selectImage.height = 100;
        rightImage.height = 100;
        leftImage.height = 100;
        const fireButton = new Menu.DispatchButton(fireImage, Display.canvas, "FIRE");
        fireButton.position.apply(75, 150);
        const selectButton = new Menu.DispatchButton(selectImage, Display.canvas, "SELECT");
        selectButton.position.apply(300, 150);
        const rightButton = new Menu.DispatchButton(rightImage, Display.canvas, "RMOVE");
        rightButton.position.apply(Display.size.x - rightImage.width - 75, 150);
        const leftButton = new Menu.DispatchButton(leftImage, Display.canvas, "LMOVE");
        leftButton.position.apply(rightButton.position.x - leftImage.width - 25, 150);

        const btns = [fireButton, selectButton, rightButton, leftButton];

        // setting up button listeners
        Display.canvas.addEventListener("RMOVE_HOLD", () => Mover.move(config.moveIncr));
        Display.canvas.addEventListener("LMOVE_HOLD", () => Mover.move(-config.moveIncr));
        Display.canvas.addEventListener("RMOVE_CLICK", () => Mover.move(config.moveIncr));
        Display.canvas.addEventListener("LMOVE_CLICK", () => Mover.move(-config.moveIncr));
        Display.canvas.addEventListener("SELECT_CLICK", () => console.info("Select button clicked"));
        Display.canvas.addEventListener("FIRE_CLICK", () => {
            if (state.projectile === undefined)
                fireProjectile(state.projectileTypes.shot1, state, config);
        });

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

    animate(state, config);
}

window.onload = load;