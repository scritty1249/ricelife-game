import { Vector, Path, Polygon, Poly } from "../geometry/geometry.js";
import { Properties } from "../projectile/projectile.js";

export function drawTerrain (cursor, polygon, fillColor, edgeColor, gradientWidth, resolution) { // fill and edge colors are expected to be Color objects
    cursor.save();
    cursor.lineCap = "round";
    cursor.lineJoin = "round";
    polygon.draw(cursor);
    cursor.fillStyle = fillColor.toString();
    cursor.fill();

    if (polygon.holes) {
        cursor.globalCompositeOperation = "destination-out";
        cursor.fillStyle = "black"; // mask color, abitrary
        
        for (const hole of polygon.holes) {
            hole.draw(cursor);
            cursor.fill();
            cursor.lineWidth = 1.5; // straight up mask a tiny extra bit around each hole lmao, we LOVE antialiasing!
            cursor.stroke();
        }        
        cursor.globalCompositeOperation = "source-over";
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

    cursor.save();
    polygon.draw(cursor);
    cursor.clip();
    cursor.globalCompositeOperation = "source-atop";
    cursor.filter = `blur(${resolution}px)`;
    cursor.lineWidth = gradientWidth;
    cursor.strokeStyle = edgeColor.toRGBA();
    topEdge.draw(cursor);
    for (const openEdge of holeTopEdges)
        openEdge.draw(cursor);
    cursor.restore();
    cursor.restore();
}

export function generateTerrain (path, maxSize) {
    path.push(
        new Vector(maxSize.x, 0),
        new Vector(0, 0)
    );
    const polygon = new Polygon(path)
    polygon.userData.collision = Properties.DESTRUCTION | Properties.ANY | Properties.TERRAIN;
    return polygon;
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