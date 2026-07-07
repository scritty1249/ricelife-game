export function deg2rad (deg) { return deg * (Math.PI / 180) }

export function rad2deg (rad) { return (rad * (180 / Math.PI)) }

export function wrapDeg (deg) { return ((deg % 360) + 360) % 360 } // for readability while debugging

export function wrapRad (rad) { const full = 2 * Math.PI; return ((rad % full) + full) % full } // for readability while debugging

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

/* Rounds a number to a specific number of decimal places (base 10).
 * 
 * roundToPlace(3.14159, 2) // => 3.14 (rounds to 2 decimal places)
 * roundToPlace(1234.56, -2) // => 1200 (rounds to the nearest hundred)
 */
export function roundToPlace (num, precision = 2) { const place = 10**precision; return Math.round(num * place) / place }

/* Rounds a number to a custom an increment/interval.
 *
 * roundTo(7.3, 2) // => 7.5 (snaps to nearest 0.5, 1 / 2 = 0.5)
 * roundTo(14, 0.25) // => 16 (snaps to nearest 4, 1 / 0.25 = 4)
 */
export function roundTo (num, precision = 1) { return Math.round(num * precision) / precision }

export function clamp (num, min, max) { return Math.min(max, Math.max(min, num)) }

export function normalizeAngle (degrees) { return (((degrees % 360) + 360) % 360) }

export function floatEqual (a, b) { return Math.abs(a - b) < Number.EPSILON }

export function global2screen (point, height) { return point.add({x: 0, y: -height}) }

export function screen2global (point, height) { return point.add({x: 0, y: height}) }

// seedable random numbers. MAY NOT BE TRUE RANDOM
export class Random {
  static #BASE = 4294967296;
  static #generateSeedPart () { return (Math.random()*2**32)>>>0 }
  static seed () {
    return [
      Random.#generateSeedPart(),
      Random.#generateSeedPart(),
      Random.#generateSeedPart(),
      Random.#generateSeedPart()
    ]
  }
  #seedA;
  #seedB;
  #seedC;
  #seedD;
  #a;
  #b;
  #c;
  #d;
  constructor (seed = Random.seed()) {
    [this.#seedA, this.#seedB, this.#seedC, this.#seedD]
      = [this.#a, this.#b, this.#c, this.#d]
      = seed;
  }

  // sfc32
  random () {
    this.#a |= 0;
    this.#b |= 0;
    this.#c |= 0;
    this.#d |= 0;
    let t = (this.#a + this.#b | 0) + this.#d | 0;
    this.#d = this.#d + 1 | 0;
    this.#a = this.#b ^ this.#b >>> 9;
    this.#b = this.#c + (this.#c << 3) | 0;
    this.#c = (this.#c << 21 | this.#c >>> 11);
    this.#c = this.#c + t | 0;
    return (t >>> 0) / Random.#BASE;
  }

  get seed () { return [this.#seedA, this.#seedB, this.#seedC, this.#seedD] }
}
