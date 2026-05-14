

function drawRotate (ctx, img, origin, degrees) {
    const rads = degrees * Math.PI / 180;

    ctx.save();
    ctx.translate(...origin);
    ctx.rotate(rads);

    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    ctx.restore();
}

let i = 0;
let z = 0;
const activeKeys = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false
};

let fps = 60;
let fpsInterval = 1000 / fps;
let last = performance.now();
const img = new Image()
img.src = "../rect.png";
function animate (canvas, ctx) {
    const current = performance.now();
    const elapsed = current - last;
    if (elapsed > fpsInterval) {
        last = current - (elapsed % fpsInterval);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 10, 10);
        drawRotate(ctx, img, [400 + z, 300], i % 360);
    }
    activeKeys.ArrowUp ? z++ : null;
    activeKeys.ArrowDown ? z-- : null;
    activeKeys.ArrowLeft ? i-- : null;
    activeKeys.ArrowRight ? i++ : null;
    requestAnimationFrame(() => animate(canvas, ctx));
}

function main() {
    img.src = "../rect.png";
    const canvas = document.getElementById("app");
    canvas.width = 1920;
    canvas.height = 1080;
    window.addEventListener("keydown", (event) => {    
        // Example: Check for a specific key
        activeKeys[event.key] = true;
        event.preventDefault();
    });
    window.addEventListener("keyup", (event) => {    
        // Example: Check for a specific key
        activeKeys[event.key] = false;
        event.preventDefault();
    });
    const ctx = canvas.getContext("2d");
    img.onload = () => animate(canvas, ctx);
}

window.onload = main;