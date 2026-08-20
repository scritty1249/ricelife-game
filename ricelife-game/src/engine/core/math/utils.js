export const TWO_PI = 2 * Math.PI;

export function clamp (num, min, max) { return Math.min(max, Math.max(min, num)) }

export function equals (a, b, thresh = Number.EPSILON) { return Math.abs(a - b) < thresh }

export function round (num, precision = 1) {
    const multiplier = Math.pow(10, precision);
    return Math.round((num + Number.EPSILON) * multiplier) / multiplier;
}

// [!] modulo operators corrupt values (floating point errors) that can interfere with equality checks
export function wrapAngle (radians) { return (radians % TWO_PI + TWO_PI) % TWO_PI }