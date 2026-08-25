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

export function drawMenuItemRulers (cursor, item, fixed = false) {
    const rulerThickness = 2;
    const borderColor = "rgba(255, 0, 0, 0.5)";
    const horizontalColor = "rgba(0, 0, 255, 0.5)";
    const verticalColor = "rgba(0, 255, 0, 0.5)";
    const bbox = item.getBoundingBox();
    const { center } = bbox;
    cursor.save();
    cursor.fixed = fixed;
    // draw borders
    cursor.save();
    bbox.draw(cursor);
    cursor.strokeStyle = borderColor;
    cursor.lineWidth = rulerThickness;
    cursor.stroke();
    drawCircle(cursor, item.getPosition(), 4, borderColor);
    cursor.restore();
    // draw x midline
    cursor.save();
    const xStart = center.clone();
    const xEnd = center.clone();
    xStart.y = bbox.min.y;
    xEnd.y = bbox.max.y;
    drawLine(cursor, xStart, xEnd, rulerThickness, horizontalColor);
    cursor.restore();
    // draw y midline
    cursor.save();
    const yStart = center.clone();
    const yEnd = center.clone();
    yStart.x = bbox.min.x;
    yEnd.x = bbox.max.x;
    drawLine(cursor, yStart, yEnd, rulerThickness, verticalColor);
    cursor.restore();
    cursor.restore();
}

export async function generateBitmapDownloadURL (bitmap, filename = "test.png") {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0);
    const blob = await canvas.convertToBlob({ type: "image/png" });
    return URL.createObjectURL(blob);
}
