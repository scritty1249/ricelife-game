import { InputListener, MovementController, TankController, AppCanvas } from "./controller/controller.js";
import { Vector, Direction, Color, Polygon } from "./geometry/geometry.js";
import { ResizedImage } from "./utils.js";
import { drawTerrain, generateTerrain } from "./terrain/terrain.js";
import * as Projectiles from "./projectile/projectile.js";

function drawCircle (ctx, radius, origin, color = "red") { // [!] debugging function
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(origin.x, origin.y, radius, 0, 2 * Math.PI);
    ctx.fill();
}

async function queueTerrainRedraw (projectile, terrain, terrainColor, displayCache, fps, resolution = .01) {
    const blastAt = projectile.intersectAt(terrain, 1 / fps, resolution);
    const blast = projectile.blast.shapeAt(blastAt);
    displayCache.clear();
    drawTerrain(displayCache.ctx, terrain.clone().cut(blast), terrainColor.fill, terrainColor.edge);
    return;
}

function handleInput (state, config) {
    // handle input jobs
    if (state.input.activeKeys.shoot && state.projectile === undefined ) {
        state.projectile = new Projectiles.BasicShot(state.tanks[config.playerTank].barrelPos, state.move.rotation + 270);
        state.redrawJob = queueTerrainRedraw(state.projectile, state.terrain, config.terrain, config.display.cache.blastBackground, config.fps);
    }
    if (state.input.activeKeys.mvfwd) {
        state.move.move(1);
    }
    if (state.input.activeKeys.mvbck) {
        state.move.move(-1);
    }
    if (state.input.activeKeys.aimcc) {
        state.tanks[config.playerTank].rotation.barrel--;
    }
    if (state.input.activeKeys.aimcw) {
        state.tanks[config.playerTank].rotation.barrel++;
    }
}

function animate (state, config) {
    const nowStamp = performance.now();
    const elapsed = nowStamp - state.lastStamp;
    const { canvas, ctx } = config.display;
    const player = state.tanks[config.playerTank];
    let waitPromise = Promise.resolve();
    // draw cache updates
    // ...

    if (elapsed < config.frameInterval) { // run any between-frame logic
    } else { // redraw frame
        state.lastStamp = nowStamp - (elapsed % config.frameInterval);
        config.display.clear();
        // check if background needs to be updated
        if (state.projectile) {
            if (state.terrain.isIntersecting(state.projectile.shape)) {
                state.terrain.cut(state.projectile.blast.shape);
                state.projectile.blast.draw(ctx);
                state.projectile = false; // set to false to flag background cache for redraw
            }
        }
        if (state.projectile === false) {
            state.projectile = undefined
            const bgCache = config.display.cache.background;
            const blastCache = config.display.cache.blastBackground;
            bgCache.clear();
            waitPromise = state.redrawJob.then(() => {
                bgCache.ctx.drawImage(blastCache.canvas, 0, 0);
                drawCircle(ctx, 4, player.barrelPos);
                drawCircle(ctx, 4, new Vector(player.position.x, player.position.y)), "green";
            });
        }
        waitPromise = waitPromise.then(() => {
            ctx.drawImage(config.display.cache.background.canvas, 0, 0);
            for (const tank of Object.values(state.tanks))
                tank.draw(ctx);
            if (state.projectile) {
                state.projectile.draw(ctx);
                state.projectile.update(1 / config.fps);
            }
        });
    }
    waitPromise.then(() => {
        handleInput(state, config);
        requestAnimationFrame(() => animate(state, config));
    });
}

async function load() {
    const tank = await new ResizedImage("../tank.png", 50).onload;
    const barrel = await new ResizedImage("../barrel.png", undefined, tank.scale).onload;
    main(tank, barrel);
}

const FPS = 60;
const GROUND = 700;
const INPUT_MAP = {
    ArrowUp: "mvfwd",
    ArrowDown: "mvbck",
    ArrowLeft: "aimcc", // counterclockwise
    ArrowRight: "aimcw", // clockwise
    Space: "shoot"
}

function main(...loaded) {
    const Display = new AppCanvas(document.getElementById("app"), new Vector(1920, 1080));
    const Inputs = new InputListener(window, INPUT_MAP);
    const Tank = new TankController(loaded[0], loaded[1], new Vector(), -15);
    const Terrain = generateTerrain(Display.size, GROUND);
    const Mover = new MovementController(Terrain, Tank, (loaded[0].height / 5));

    const config = {
        fps: FPS,
        frameInterval: 1000 / FPS,
        display: Display,
        playerTank: Tank.id,
        terrain: {
            edge: new Color("#03f5ff"),
            fill: new Color("#00a5ff")
        }
    };
    const state = {
        input: Inputs,
        move: Mover,
        polygons: {},
        projectile: undefined,
        tanks: {[Tank.id]: Tank},
        terrain: Terrain,
        cacheUpdate: {"background": false},
        lastStamp: performance.now(),
        redrawJob: Promise.resolve()
    };
    Display.createCache("blastBackground");
    Display.createCache("background");
    drawTerrain(Display.cache.background.ctx, Terrain, config.terrain.fill, config.terrain.edge);
    Mover.set(Math.floor(Display.size.x / 4));
    // [!] TODO: configure tank body rotation

    animate(state, config);
}

window.onload = load;