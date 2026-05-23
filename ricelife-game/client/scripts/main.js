import { InputListener, MovementController, TankController, AppCanvas } from "./controller/controller.js";
import { Vector, Direction, Color, Polygon } from "./geometry/geometry.js";
import { ResizedImage, drawCircle, drawMarker, rad2deg } from "./utils.js";
import { drawTerrain, generateTerrain } from "./terrain/terrain.js";
import * as Projectiles from "./projectile/projectile.js";

function queueTerrainRedraw (projectile, terrain, terrainColor, displayCache, fps, resolution = .01) {
    const blastAt = projectile.intersectAt(terrain, 1 / fps, resolution);
    const blast = projectile.blast.shapeAt(blastAt);
    displayCache.clear();
    drawTerrain(displayCache.ctx, terrain.cut(blast), terrainColor.fill, terrainColor.edge);
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
                drawCircle(ctx, player.barrelPos);
                drawCircle(ctx, new Vector(player.position.x, player.position.y)), "green";
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

function animateSingleThread (state, config) { // [!] temporary for testing
    const nowStamp = performance.now();
    const elapsed = nowStamp - state.lastStamp;
    const { canvas, ctx } = config.display;
    const player = state.tanks[config.playerTank];

    // draw cache updates
    // ...

    if (elapsed < config.frameInterval) { // run any between-frame logic
    } else { // redraw frame
        state.lastStamp = nowStamp - (elapsed % config.frameInterval);
        config.display.clear();

        if (state.projectile)
            if (state.terrain.isIntersecting(state.projectile.position)) {
                config.display.cache.background.clear();
                for (const shape of state.projectile.blast.shapes) {
                    state.terrain.cut(shape, true)
                }
                drawTerrain(config.display.cache.background.ctx, state.terrain, config.terrain.fill, config.terrain.edge);
                state.projectile = state.projectile.blast;
            } else if (state.projectile.position.x < 0 // delete if out of bounds
                || state.projectile.position.x > config.display.size.x
                || state.projectile.position.y > config.display.size.y) // allow projectile to go offscreen if straight up
                state.projectile = false;

        ctx.drawImage(config.display.cache.background.canvas, 0, 0);
        for (const tank of Object.values(state.tanks))
            tank.draw(ctx);
        if (state.projectile)
            state.projectile.draw(ctx);
            if (state.projectile?.isProjectile) {
                state.projectile.update(1 / config.fps);
            } else
                state.projectile = false;
        if (state.trace) {
            ctx.setLineDash([10, 20]);
            ctx.strokeStyle = "rgba(255, 255, 255, .35)";
            state.trace.draw(ctx);
        }
    }

    if (window?.debugTools) {
        // testing
        drawCircle(ctx, player.barrelPos);
        drawCircle(ctx, new Vector(player.position.x, player.position.y), "green");
        ctx.save();          // Save state to undo clipping later
        state.terrain.draw(ctx);
        ctx.clip("evenodd"); 
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 4;
        ctx.stroke(); 
        ctx.restore();

        drawCircle(ctx, new Vector(player.position.x, 20), 7, "purple")
        drawCircle(ctx, new Vector(player.position.x, config.display.size.y - 20), 7, "white")
        state.terrain.raycast(new Vector(player.position.x, 0), Direction(90), config.display.size.y - 1.1)
            .toSorted((a, b) => b.point.y - a.point.y)
            .forEach(({point, angle, entering}, i) => drawMarker(ctx, point, Direction((angle + Math.PI) % (2 * Math.PI), false), 4, 20, entering ? "purple" : "white"));
    }

    // handle input jobs
    if (state.input.activeKeys.shoot && !state.projectile ) {
        state.lastShot = nowStamp;
        state.projectile = new Projectiles.Spreader(player.barrelPos, state.move.rotation + 270);
        state.trace = state.projectile.tracer;
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
    requestAnimationFrame(() => animateSingleThread(state, config));
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
    const Tank = new TankController(loaded[0], loaded[1], new Vector());
    const Terrain = generateTerrain(Display.size, GROUND);
    const Mover = new MovementController(Terrain, Tank, (loaded[0].height / 5));

    const config = {
        fps: FPS,
        frameInterval: 1000 / FPS,
        display: Display,
        playerTank: Tank.id,
        terrain: {
            edge: new Color("#00e8f0"),
            fill: new Color("#0098eb")
        }
    };
    const state = {
        input: Inputs,
        move: Mover,
        polygons: {},
        projectile: undefined,
        trace: undefined,
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
    Tank.offset.barrel.y = -15;
    Tank.offset.body.y = -(loaded[0].height / 2);

    animateSingleThread(state, config);
}

window.onload = load;