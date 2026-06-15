export function deg2rad (deg) { return deg * (Math.PI / 180) }

export function rad2deg (rad) { return rad * (180 / Math.PI) }

export function str2hex (str) {
  return str
    .split("")
    .map(char => char.charCodeAt(0).toString(16).padStart(2, "0"))
    .join("");
}

export function averageAngle (radians = []) {
  if (!radians || radians.length === 0) return 0;
  let x = 0, y = 0;
  for (const angle of radians) {
    x += Math.cos(angle);
    y += Math.sin(angle);
  }
  const count = radians.length;
  let avg = Math.atan2(y / count, x / count);
  if (avg < 0) avg += 2 * Math.PI; // clamp / normalize
  return avg;
}

export function roundToPlace (num, precision = 2) { const place = 10**precision; return Math.round(num * place) / place }

export function roundTo (num, precision = 1) { return Math.round(num * precision) / precision }

export function clamp (num, min, max) { return Math.min(max, Math.max(min, num)) }

export function normalizeAngle (degrees) { return (((degrees % 360) + 360) % 360) }

export function floatEqual (a, b) { return Math.abs(a - b) < Number.EPSILON }

export function global2screen (point, height) { return point.add({x: 0, y: -height}) }

export function screen2global (point, height) { return point.add({x: 0, y: height}) }
