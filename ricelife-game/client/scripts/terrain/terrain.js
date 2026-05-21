

export function drawTerrain (ctx, polygon, fillColor, edgeColor, gradientWidth = 150, resolution = 1) { // fill and edge colors are expected to be Color objects
    polygon.draw(ctx);
    ctx.fillStyle = fillColor.toString();
    ctx.fill();
    ctx.save();
    polygon.draw(ctx);
    ctx.clip(); 
    const topEdge = polygon.clone();
    console.log(topEdge);
    topEdge.points = topEdge.points.slice(0, -2);
    console.log(topEdge);
    for (let i = 0; i <= gradientWidth; i+=resolution) {
        const alpha = (1 - (i / gradientWidth)).toFixed(2)**10;
        ctx.lineWidth = i*2;
        ctx.strokeStyle = `rgba(${edgeColor.r}, ${edgeColor.g}, ${edgeColor.b}, ${alpha})`;
        topEdge.draw(ctx, false);
    }
    ctx.restore();
}