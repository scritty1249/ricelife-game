export function drawCircle (cursor, origin, radius = 4, color = "red") { // [!] debugging function
    cursor.save();
    cursor.fillStyle = color;
    cursor.beginPath();
    cursor.arc(origin.x, origin.y, radius, 0, 2 * Math.PI);
    cursor.fill();
    cursor.restore();
}

export function drawMarker (cursor, origin, direction, radius = 4, length = 15, color = "red") { // [!] debugging function
    drawCircle(cursor, origin, radius, color);
    drawLine(cursor, origin, origin.add(direction.mul(length * 2)), radius/2, color);
}

export function drawLine (cursor, origin, target, thickness = 2, color = "red") { // [!] debugging function
    cursor.save();
    cursor.strokeStyle = color;
    cursor.lineWidth = thickness;
    cursor.beginPath();
    cursor.moveTo(origin);
    cursor.lineTo(target);
    cursor.stroke();
    cursor.restore();
}

export function drawText (cursor, position, text, color = "red", font = "48px serif") { // [!] debugging function
    cursor.save();
    cursor.fillStyle = color;
    cursor.font = font;
    cursor.fillText(text, position);
    cursor.restore();
}

export function outlineImage (cursor, loadedImage, position, thickness = 2, color = "red") { // [!] debugging function
    const [ tl, tr, br, bl ] = loadedImage.getEdges(position);
    drawLine(cursor, tl, tr, thickness, color);
    drawLine(cursor, tr, br, thickness, color);
    drawLine(cursor, br, bl, thickness, color);
    drawLine(cursor, bl, tl, thickness, color);
}
