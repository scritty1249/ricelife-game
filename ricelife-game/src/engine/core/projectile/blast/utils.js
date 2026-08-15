import { equals } from "../../math/utils.js";

// group blasts that occur at the same time
export function sortBlastGroups (blasts = []) {
    if (!blasts?.length) return [];
    const uniq = [];
    const groupedBlasts = Array.from(Map.groupBy(blasts, ({delay}) => {
        const value = uniq.find((key) => equals(key, delay))
        if (value !== undefined) return value;
        uniq.push(delay);
        return delay;
    }).entries())
    .sort((a, b) => a[0] - b[0])
    .map(([_, blast]) => blast);
    return groupedBlasts;
}

export function drawBlastAnimation (cursor, shape, progress, color, fadeDecay = 1) {
    const clr = color.clone();
    clr.a = 1 - (progress**fadeDecay);
    cursor.save();
    cursor.fillStyle = clr.toString();
    shape.draw(cursor);
    cursor.fill();
    cursor.restore();
}
