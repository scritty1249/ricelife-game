import { Vector, Path, Polygon } from "../geometry/geometry.js";

export function drawTerrain (ctx, polygon, fillColor, edgeColor, gradientWidth, resolution) { // fill and edge colors are expected to be Color objects
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    polygon.draw(ctx);
    ctx.fillStyle = fillColor.toString();
    ctx.fill();

    if (polygon.holes) {
        ctx.globalCompositeOperation = "destination-out";
        ctx.fillStyle = "black"; // mask color, abitrary
        
        for (const hole of polygon.holes) {
            hole.draw(ctx);
            ctx.fill();
            ctx.lineWidth = 1.5; // straight up mask a tiny extra bit around each hole lmao, we LOVE antialiasing!
            ctx.stroke();
        }        
        ctx.globalCompositeOperation = "source-over";
    }

    const topEdge = polygon.path.clone();
    {
        // trim off the bottom (opening the path)
        const yMax = Math.max(...topEdge.points.map((pt) => pt.y));
        const pt1 = topEdge.points.findIndex((pt) => pt.y == yMax);
        const pt2 = topEdge.points.findLastIndex((pt) => pt.y == yMax);
        topEdge.splice(pt1, 1);
        topEdge.splice(pt2 - 1, 1);
        topEdge.apply(
            ...topEdge.points.toSorted((a, b) => a.x - b.x)
        );
    }

    const holeTopEdges = [];
    if (polygon.holes) {
        for (const hole of polygon.holes) {
            const holeEdge = hole.path.clone();
            const yMax = Math.max(...holeEdge.points.map((pt) => pt.y));
            holeEdge.apply(...holeEdge.points.filter(pt => pt.y < yMax - 5)); 
            if (holeEdge.points.length > 1) {
                holeEdge.points.sort((a, b) => a.x - b.x);
                holeTopEdges.push(holeEdge);
            }
        }
    }

    ctx.save();
    polygon.draw(ctx);
    ctx.clip();
    ctx.globalCompositeOperation = "source-atop";
    for (let i = 0; i <= gradientWidth; i += resolution) {
        const alpha = (1 - (i / gradientWidth)).toFixed(2)**10;
        ctx.lineWidth = i * 2;
        ctx.strokeStyle = `rgba(${edgeColor.r}, ${edgeColor.g}, ${edgeColor.b}, ${alpha})`;
        topEdge.draw(ctx);
        for (const openHoleEdge of holeTopEdges)
            openHoleEdge.draw(ctx);
    }
    ctx.restore();
}

export function generateTerrain (path, maxSize) {
    path.push(
        new Vector(maxSize.x, maxSize.y - 1),
        new Vector(0, maxSize.y - 1)
    );
    return new Polygon(path);
};

export function generateWave(length, resolution = 1, modifier = (vector) => {}, freq = 0.03, amplitude = 40, smoothness = 1.3, randomness = 15) {
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