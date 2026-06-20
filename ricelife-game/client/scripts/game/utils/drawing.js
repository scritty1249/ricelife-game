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
    const { size } = loadedImage;
    const one = position.clone(),
        two = position.clone(),
        three = position.clone(),
        four = position.clone();
    two.x += size.x;
    three.x += size.x; three.y -= size.y;
    four.y -= size.y;
    drawLine(cursor, one, two, thickness, color);
    drawLine(cursor, two, three, thickness, color);
    drawLine(cursor, three, four, thickness, color);
    drawLine(cursor, four, one, thickness, color);
}
