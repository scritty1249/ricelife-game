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

    cursor.save();
    polygon.draw(cursor);
    cursor.clip();
    cursor.globalCompositeOperation = "source-atop";
    cursor.filter = `blur(${resolution}px)`;
    cursor.lineWidth = gradientWidth;
    cursor.strokeStyle = edgeColor.toRGBA();
    for (const edge of polygon.edges)
        edge.draw(cursor);
    cursor.stroke();
    cursor.restore();
    cursor.restore();
}