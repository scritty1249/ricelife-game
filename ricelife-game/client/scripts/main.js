import { InputListener, MovementController, TankController, AppCanvas } from "./controller/controller.js";
import { Vector, Direction, Color, Polygon, GeometryWorker, Ray, Path } from "./geometry/geometry.js";
import { ResizedImage, drawCircle, drawMarker, rad2deg, roundTo } from "./utils.js";
import { drawTerrain, generateTerrain, generateWave } from "./terrain/terrain.js";
import * as Projectiles from "./projectile/projectile.js";

// [!] for debugging
const URL_PARAMS = new URLSearchParams(window?.location?.search);


async function fireProjectile (shot, state, config) { // [!} laziness
    state.projectile = new shot(state.tanks[config.playerTank].barrelPos, state.move.rotation + 270);
    state.tracer = state.projectile.tracer;
    state.blastTerrain = state.terrain.clone();
    state.landing = state.projectile.intersectAt(state.blastTerrain, 1/config.fps, config.display.size.x); // [!] for testing
    if (state.landing) {
        state.redrawJob = state.geometry.cut("blastTerrain", state.terrain, ...state.projectile.blast.shapesAt(state.landing.point))
            .then((polygon) => polygon.roundPoints(2))
            .then((polygon) => state.blastTerrain.apply(polygon))
            .then((polygon) => config.display.drawTerrain("blastBackground", state.blastTerrain, config.terrain.fill, config.terrain.edge));
    }
}

function handleInput (state, config) {
    // handle input jobs
    if (state.projectile === undefined) {
        if (state.input.activeKeys.shoot1)
            fireProjectile(state.projectileTypes.shoot1, state, config);
        else if (state.input.activeKeys.shoot2)
            fireProjectile(state.projectileTypes.shoot2, state, config);
        else if (state.input.activeKeys.shoot3)
            fireProjectile(state.projectileTypes.shoot3, state, config);
    }
    state.tanks[config.playerTank].position.round(1/GLOBAL_RESOLUTION);
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
                state.projectile = false; // set to false to flag background cache for redraw
            }
        }
        if (state.projectile === false) {
            state.projectile = undefined;
            waitPromise = state.redrawJob
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
            config.display.clear();
            for (const tank of Object.values(state.tanks))
                tank.draw(ctx);
            ctx.drawImage(config.display.worker.cache.background.image, 0, 0);
            if (state.projectile) {
                state.projectile.draw(ctx);
                if (state.projectile.isProjectile) {
                    state.projectile.update(1 / config.fps);
                } else state.projectile = false;
            }
            if (state.tracer) state.tracer.draw(ctx);

            if (window?.debugTools || (URL_PARAMS.get("debug") && window?.debugTools !== false)) {
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
                drawCircle(ctx, new Vector(player.position.x, player.position.y), 5,  "green");
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
                const ray = Ray(new Vector(player.position.x, 0), Direction(90), config.display.size.y - 20);
                drawCircle(ctx, ray.at(0), 7, "purple")
                drawCircle(ctx, ray.at(-1), 7, "white")
                state.terrain.raycast(ray)
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
const GLOBAL_RESOLUTION = Math.floor((1/2) * 10) / 10;
const INPUT_MAP = {
    ArrowUp: "mvfwd",
    ArrowDown: "mvbck",
    ArrowLeft: "aimcc", // counterclockwise
    ArrowRight: "aimcw", // clockwise
    Space: "shoot1",
    KeyF: "shoot2",
    KeyG: "shoot3"

}

function main(...loaded) {
    const Display = new AppCanvas(document.getElementById("app"), new Vector(1920, 1080));
    const Inputs = new InputListener(window, INPUT_MAP);
    const Tank = new TankController(loaded[0], loaded[1], new Vector());
    // [!] testing
    const Terrain = URL_PARAMS.get("map") == "flat"
        ? generateTerrain(new Path(new Vector(0, GROUND), new Vector(Display.size.x, GROUND)).smooth(GLOBAL_RESOLUTION), Display.size)
        : generateTerrain(generateWave(Display.size.x, GLOBAL_RESOLUTION, (v) => v.y += GROUND, .03, 40, 1.3, 15), Display.size);
    const Mover = new MovementController(Terrain, Tank, (loaded[0].height / 7));
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
        geometry: new GeometryWorker(),
        
        // uncertain about these. will likely refactor out in near future don't implement too much that relies on these
        projectile: undefined,
        tracer: undefined,
        landing: undefined,
        blastTerrain: undefined,
        projectileTypes: {
            shoot1: Projectiles.BasicShot,
            shoot2: Projectiles.Spreader,
            shoot3: Projectiles.Flower   
        },

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