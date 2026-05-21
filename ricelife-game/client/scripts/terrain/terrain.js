import { Vector, Path, Polygon } from "../geometry/geometry.js";

export function drawTerrain (ctx, polygon, fillColor, edgeColor, gradientWidth = 150, resolution = 1) { // fill and edge colors are expected to be Color objects
    polygon.draw(ctx);
    ctx.fillStyle = fillColor.toString();
    ctx.fill();
    ctx.save();
    polygon.draw(ctx);
    ctx.clip(); 
    const topEdge = polygon.path.clone();
    topEdge.splice(-2); // trim off the bottom (opening the path)
    for (let i = 0; i <= gradientWidth; i+=resolution) {
        const alpha = (1 - (i / gradientWidth)).toFixed(2)**10;
        ctx.lineWidth = i*2;
        ctx.strokeStyle = `rgba(${edgeColor.r}, ${edgeColor.g}, ${edgeColor.b}, ${alpha})`;
        topEdge.draw(ctx);
    }
    ctx.restore();
}

export function generateTerrain(size, originHeight, resolution = 1, smoothness = 1.3, randomness = 15) {
    const terrainPath = generateWave(
        size.x,
        resolution,
        (pt) => (pt.y = originHeight + pt.y),
        .03,
        40,
        smoothness,
        randomness
    );
    terrainPath.push(
        new Vector(size.x, size.y - 1),
        new Vector(0, size.y - 1)
    );
    return new Polygon(terrainPath);
}

function generateWave(length, resolution = 1, modifier = (vector) => {}, freq = 0.03, amplitude = 40, smoothness = 1.3, randomness = 15) {
    const wave = new Path();
    const phases = [Math.random() * Math.PI, Math.random() * Math.PI];
    const randAmp = randomness + Math.random() * randomness; // this second amplitude determines variation amount
    for (let x = 0; x < length; x+=resolution) {
        const point = new Vector(x,
            Math.sin(x * freq + phases[0]) * amplitude
            + Math.sin(x * freq * smoothness + phases[1]) * randAmp
        );
        modifier(point);
        wave.points.push(point);
    }
    return wave;
}