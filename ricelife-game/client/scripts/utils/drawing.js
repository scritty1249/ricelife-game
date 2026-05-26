export function drawCircle (ctx, origin, radius = 4, color = "red") { // [!] debugging function
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(origin.x, origin.y, radius, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();
}

export function drawMarker (ctx, origin, direction, radius = 4, length = 15, color = "red") { // [!] debugging function
    drawCircle(ctx, origin, radius, color);
    drawLine(ctx, origin, origin.add(direction.mul(length * 2)), radius/2, color);
}

export function drawLine (ctx, origin, target, thickness = 2, color = "red") { // [!] debugging function
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = thickness;
    ctx.beginPath();
    ctx.moveTo(...origin);
    ctx.lineTo(...target);
    ctx.stroke();
    ctx.restore();
}
