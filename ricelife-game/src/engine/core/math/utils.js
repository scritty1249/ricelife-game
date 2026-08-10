export function clamp (num, min, max) { return Math.min(max, Math.max(min, num)) }

export function equals (a, b) { return Math.abs(a - b) < Number.EPSILON }

export function round (num, precision = 1) {
    const multiplier = Math.pow(10, precision);
    return Math.round((num + Number.EPSILON) * multiplier) / multiplier;
}
