export function deg2rad (deg) { return deg * (Math.PI / 180) }

export function rad2deg (rad) { return rad * (180 / Math.PI) }

export function str2hex (str) {
  return str
    .split("")
    .map(char => char.charCodeAt(0).toString(16).padStart(2, "0"))
    .join("");
}

export function roundToPlace (num, precision = 2) { const place = 10**precision; return Math.round(num * place) / place }

export function roundTo (num, precision = 1) { return Math.round(num * precision) / precision }

export function clamp (num, min, max) { return Math.min(max, Math.max(min, num)) }

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

export function normalizeAngle (degrees) {
    return (((degrees % 360) + 360) % 360);
}

export function floatEqual (a, b) { return Math.abs(a - b) < Number.EPSILON }

export function uuid () { return crypto.randomUUID() }

export class TrackableObject {
    #id;
    constructor() {
        this.#id = uuid();
    }
    get id () { return this.#id };
}

export class ResizedImage {
    #img;
    #width;
    #height;
    #loadPromise;
    #scale;
    #ready = false;
    constructor (src, width = undefined, scale = undefined) {
        this.#width = 0;
        this.#height = 0;
        this.#img = new Image();
        this.#loadPromise = new Promise((resolve, reject) => {
            this.#img.onerror = (e) => (this.#ready = undefined, reject(e));
            this.#img.onload = () => {
                this.#ready = true;
                this.#scale = (width === undefined) ? scale : width / this.#img.width;
                this.#width = this.#scale * this.#img.width
                this.#height = this.#scale * this.#img.height;
                resolve(this);
            };

        });
        this.#img.src = src;
    }
    get ready () { return this.#ready; }
    get onload () { return this.#ready ? Promise.resolve(this) : this.#loadPromise; }
    get img () {
        if (!this.#ready)
            throw new Error("[ResizedImage] Error: Cannot access image - not loaded");
        return this.#img;
    }
    get width () { return this.#width; }
    get height () { return this.#height; }
    get scale () { return this.#scale; }
}