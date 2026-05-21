import { Projectile } from "./controller/physics.js";
import { Vector, Direction, Color } from "./geometry/vector.js";
import { Polygon } from "./geometry/polygon.js";
import { InputListener, MovementController } from "./controller/movement.js";
import { TankController } from "./controller/tank.js";
import { ResizedImage } from "./utils.js";
import { drawTerrain } from "./terrain/terrain.js";
import AppCanvas from "./controller/display.js";

function drawRotate (ctx, img, dx, dy, degrees, width, height) {
    const rads = degrees * Math.PI / 180;

    ctx.save();
    ctx.translate(dx, dy);
    ctx.rotate(rads);

    ctx.drawImage(img, -width / 2, -height, width, height); // rotated around bottom, center of image
    ctx.restore();
}

function drawCircle (ctx, radius, origin, color = "red") {
    // 2. Set dot properties (color and position/size)
    ctx.fillStyle = color; // Set the dot color

    // 3. Draw the dot
    ctx.beginPath();
    ctx.arc(origin.x, origin.y, radius, 0, 2 * Math.PI); // Create circle
    ctx.fill(); // Fill the circle
}

function generateWave(length, resolution = 1, modifier = (vector) => {}, freq = 0.03, amplitude = 40, smoothness = 1.3, randomness = 15) {
    const points = [];
    const phases = [Math.random() * Math.PI, Math.random() * Math.PI];
    const randAmp = randomness + Math.random() * randomness; // this second amplitude determines variation amount

    for (let x = 0; x < length; x+=resolution) {
        const vector = new Vector(x,
            Math.sin(x * freq + phases[0]) * amplitude
            + Math.sin(x * freq * smoothness + phases[1]) * randAmp
        );
        modifier(vector);
        points.push(vector);
    }
    return points;
}

function animate (state, config) {
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
        ctx.drawImage(config.display.cache.background.canvas, 0, 0);
        for (const tank of Object.values(state.tanks))
            tank.draw(ctx);
        for (const projectile of Object.values(state.projectiles)) {
            // [!] placeholder
            drawCircle(ctx, 10, projectile.position);
            projectile.update(1 / config.fps);
        }
    }

    drawCircle(ctx, 4, player.barrelPos);
    drawCircle(ctx, 4, new Vector(player.position.x, player.position.y)), "green";

    // handle input jobs
    if (state.input.activeKeys.shoot && nowStamp - state.lastShot > state.shotCd ) {
        state.lastShot = nowStamp;
        const proj = new Projectile(
            player.barrelPos,
            Direction(state.move.rotation + 270)
                .mul(400),
            new Vector(20, 200),
            0.001
        );
        state.projectiles[proj.id] = proj;
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
    requestAnimationFrame(() => animate(state, config));
}

async function load() {
    const tank = await new ResizedImage("../tank.png", 50).onload;
    const barrel = await new ResizedImage("../barrel.png", undefined, tank.scale).onload;
    main(tank, barrel);
}

const FPS = 60;
const GROUND = 700;
const SHOOT_COOLDOWN_MS = 1000 * .8;
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
    const terrain = new Polygon(
        ...generateWave(Display.size.x, 1, (vec) => (vec.y = GROUND + vec.y)),
        new Vector(Display.size.x, Display.size.y),
        new Vector(0, Display.size.y)
    );
    const Mover = new MovementController(terrain, Tank, -(loaded[0].height / 5));

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
        projectiles: {},
        tanks: {[Tank.id]: Tank},
        terrain: terrain,
        cacheUpdate: {"background": false},
        lastStamp: performance.now(),
        // [!] temporary
        lastShot: 0,
        shotCd: SHOOT_COOLDOWN_MS
    };

    Display.createCache("background");
    drawTerrain(Display.cache.background.ctx, terrain, config.terrain.fill, config.terrain.edge);
    Mover.set(Math.floor(Display.size.x / 2));
    // [!] TODO: configure tank body rotation

    animate(state, config);
}

window.onload = load;