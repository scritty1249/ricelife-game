import { InputListener, MovementController, TankController, AppCanvas } from "./controller/controller.js";
import { Vector, Direction, Color, Polygon } from "./geometry/geometry.js";
import { ResizedImage, drawCircle, drawMarker, rad2deg } from "./utils.js";
import { drawTerrain, generateTerrain } from "./terrain/terrain.js";
import * as Projectiles from "./projectile/projectile.js";

async function fireProjectile (state, config) { // [!} laziness
    state.projectile = new state.projectileType(state.tanks[config.playerTank].barrelPos, state.move.rotation + 270);
    state.blastedTerrain = state.terrain.clone();
    state.landing = state.projectile.intersectAt(state.blastedTerrain, 1/config.fps, config.display.size.x); // [!] for testing
    if (state.landing) {
        for (const shape of state.projectile.blast.shapesAt(state.landing.point))
            state.blastedTerrain.cut(shape, true);
        state.redrawJob = config.display.drawTerrain("blastBackground", state.blastedTerrain, config.terrain.fill, config.terrain.edge);
    }
}

function handleInput (state, config) {
    // handle input jobs
    if (state.input.activeKeys.shoot && state.projectile === undefined ) {
        fireProjectile(state, config);
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
    let waitPromise = config.display.worker.cache.background ? Promise.resolve() : state.redrawJob;
    // draw cache updates
    // ...

    if (elapsed < config.frameInterval) { // run any between-frame logic
    } else { // redraw frame
        state.lastStamp = nowStamp - (elapsed % config.frameInterval);
        // check if background needs to be updated
        if (state.projectile) {
            if (state.terrain.isIntersecting(state.projectile.shape)) {
                state.terrain.apply(state.blastedTerrain);
                state.move.set(player.position.x, true); // update positioning - account for "falling"
                state.projectile = false; // set to false to flag background cache for redraw
            }
        }
        if (state.projectile === false) {
            state.projectile = undefined;
            waitPromise = state.redrawJob
                .then(() => config.display.copyCanvas("background", config.display.worker.cache.blastBackground.image));
        }
        waitPromise = waitPromise.then(() => {
            // Draw the foreground (main game loop - related polygons and images)
            config.display.clear();
            ctx.drawImage(config.display.worker.cache.background.image, 0, 0);
            for (const tank of Object.values(state.tanks))
                tank.draw(ctx);
            if (state.projectile) {
                state.projectile.draw(ctx);
                if (state.projectile.isProjectile) {
                    state.projectile.tracer.draw(ctx);
                    state.projectile.update(1 / config.fps);
                } else state.projectile = false;
            }
            if (window?.debugTools || (new URLSearchParams(window.location.search).get("debug") && window?.debugTools !== false)) {
                // [!] testing

                // draw any holes in terrain
                for (const hole of state.terrain.holes) {
                    ctx.save();
                    hole.draw(ctx);
                    ctx.strokeStyle = "red";
                    ctx.lineWidth = 2;
                    ctx.stroke();
                    ctx.restore();
                }

                // draw player body and barrel positions
                drawCircle(ctx, player.barrelPos);
                drawCircle(ctx, new Vector(player.position.x, player.position.y), "green");
                { // draw terrain outline. Draws holes weirdly though
                    ctx.save();
                    state.terrain.draw(ctx);
                    ctx.clip("evenodd"); 
                    ctx.strokeStyle = "blue";
                    ctx.lineWidth = 4;
                    ctx.stroke(); 
                    ctx.restore();
                }

                // draw Y-axis positioning raycasters
                drawCircle(ctx, new Vector(player.position.x, 20), 7, "purple")
                drawCircle(ctx, new Vector(player.position.x, config.display.size.y - 20), 7, "white")
                state.terrain.raycast(new Vector(player.position.x, 0), Direction(90), config.display.size.y - 1.1)
                    .toSorted((a, b) => b.point.y - a.point.y)
                    .forEach(({point, angle, entering}, i) => drawMarker(ctx, point, Direction((angle + Math.PI) % (2 * Math.PI), false), 4, 20, entering ? "purple" : "white"));
                
                if (state.projectile) {
                    // draw blast radius while in flight
                    ctx.save();
                    ctx.strokeStyle = "orange";
                    ctx.lineWidth = 2;
                    for (const shape of state.projectile.blast.shapes)
                        shape.path.draw(ctx);
                    ctx.stroke(); 
                    ctx.restore();
                    if (state.landing) drawCircle(ctx, state.landing.point, state.projectile.config.radius, "orange"); // draw landing point
                } else state.landing = undefined;
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
    const Tank = new TankController(loaded[0], loaded[1], new Vector());
    const Terrain = generateTerrain(Display.size, GROUND);
    const Mover = new MovementController(Terrain, Tank, (loaded[0].height / 5));

    Display.createCache("blastBackground");
    Display.createCache("background");

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
        
        // uncertain about these. will likely refactor out in near future don't implement too much that relies on these
        projectile: undefined,
        trace: undefined,
        landing: undefined,
        blastedTerrain: undefined,
        projectileType: Projectiles.Flower,

        tanks: {[Tank.id]: Tank},
        terrain: Terrain,
        lastStamp: performance.now(),
        redrawJob: Display.drawTerrain("background", Terrain, config.terrain.fill, config.terrain.edge)
    };
    
    Mover.set(Math.floor(Display.size.x / 4));
    Tank.offset.barrel.y = -15;
    Tank.offset.body.y = -(loaded[0].height / 2);

    animate(state, config);
}

window.onload = load;