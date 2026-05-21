import { Projectile } from "./physics.js";
import { Vector, Direction } from "./vector.js";
import { Polygon } from "./polygon.js";

function drawRotate (ctx, img, dx, dy, degrees) {
    const rads = degrees * Math.PI / 180;

    ctx.save();
    ctx.translate(dx, dy);
    ctx.rotate(rads);

    ctx.drawImage(img, 0, -img.height / 2);
    ctx.restore();
}

function drawCircle (ctx, radius, origin, color = "black") {
    // 2. Set dot properties (color and position/size)
    ctx.fillStyle = 'red'; // Set the dot color

    // 3. Draw the dot
    ctx.beginPath();
    ctx.arc(origin.x, origin.y, radius, 0, 2 * Math.PI); // Create circle
    ctx.fill(); // Fill the circle
}

function getTrajectoryPosition(seconds, velocity, angle, drop, drag, origin) {
    // Convert angle to radians
    const rad = -angle * (Math.PI / 180); 
    
    return {
        x: origin.x + (velocity * seconds * Math.cos(rad)),
        y: origin.barrelY - (velocity * seconds * Math.sin(rad)) - (0.5 * -drop * Math.pow(seconds, 2))
    };
}
const ground = 700;
const currentPos = {
    x: 400,
    y: ground,
    rotation: 0,
    get barrelY() {
        return this.y - 15
    }
};
const activeKeys = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
    Space: false
};

let fps = 60;
let fpsInterval = 1000 / fps;
let last = performance.now();
const tankImg = new Image()
const barrelImg = new Image()
let projectiles = [];
const polys = [];
function animate (canvas, ctx) {
    const current = performance.now();
    const elapsed = current - last;
    if (elapsed > fpsInterval) {
        last = current - (elapsed % fpsInterval);
        ctx.clearRect(0, 0, canvas.width, canvas.height);        
        drawRotate(ctx, barrelImg, currentPos.x, currentPos.barrelY, currentPos.rotation % 360);
        ctx.drawImage(tankImg, currentPos.x - (tankImg.width / 2), currentPos.y - (tankImg.height / 2));
        projectiles.forEach((proj) => {
            drawCircle(ctx, 10, proj.position);
            proj.update(1 / fps);
        });
        polys.forEach((poly) => {
            poly.draw(ctx);
            // ctx.strokeStyle = 'orange';
            // ctx.lineWidth = 3;
            // ctx.lineCap = 'round';
            // ctx.lineJoin = 'round';
            // ctx.stroke();
            ctx.fillStyle = 'orange';
            ctx.fill();
        });
        if (activeKeys.Space) {
            activeKeys.Space = false;
            projectiles.push(new Projectile(
                new Vector(currentPos.x, currentPos.barrelY),
                Direction(currentPos.rotation)
                    .mul(1000),
                new Vector(0, 500),
                0.001
            ));
        }
        
    }
    activeKeys.ArrowUp ? currentPos.x++ : null;
    activeKeys.ArrowDown ? currentPos.x-- : null;
    activeKeys.ArrowLeft ? currentPos.rotation-- : null;
    activeKeys.ArrowRight ? currentPos.rotation++ : null;
    requestAnimationFrame(() => animate(canvas, ctx));
}

function generateWave(length, resolution = 1, modifier = (vector) => {}, freq = 0.03, amplitude = 60) {
    const points = [];
    const phases = [Math.random() * Math.PI, Math.random() * Math.PI];
    const randAmp = 30 + Math.random() * 30; // this second amplitude determines variation amount

    for (let x = 0; x < length; x+=resolution) {
        const vector = new Vector(x,
            Math.sin(x * freq + phases[0]) * amplitude
            + Math.sin(x * freq * 2.3 + phases[1]) * randAmp
        );
        modifier(vector);
        points.push(vector);

    }
    return points;
}

function main() {
    barrelImg.src = "../barrel.png";
    tankImg.src = "../tank.png";
    const canvas = document.getElementById("app");
    canvas.width = 1920;
    canvas.height = 1080;
    window.addEventListener("keydown", (event) => {    
        // Example: Check for a specific key
        activeKeys[event.code] = true;
        event.preventDefault();
    });
    window.addEventListener("keyup", (event) => {    
        // Example: Check for a specific key
        activeKeys[event.code] = false;
        event.preventDefault();
    });
    const ctx = canvas.getContext("2d");
    Promise.all([
        tankImg.onload,
        barrelImg.onload
    ]).then(() => {
        // setup
        const wave = generateWave(canvas.width, 1, (vector) => (vector.y = ground + vector.y));
        const terrain = new Polygon(...wave, new Vector(canvas.width, canvas.height), new Vector(0, canvas.height));
        console.log(terrain);
        polys.push(terrain);
    }).then(() => animate(canvas, ctx));
}

window.onload = main;