import { Vector, BoundingBox } from "../geometry/geometry.js";
import { floatEqual, clamp } from "../utils/utils.js";

// counts framerate
export class FrameCounter {
    #historyLength;
    #history = new Array();
    #lastUpdateAt = performance.now();
    #fps = 0;
    constructor (historyLength = 10) {
        this.length = historyLength;
    }

    update () {
        const history = this.#history;
        const now = performance.now();
        const delta = (now - this.lastUpdateAt) / 1000;
        this.#lastUpdateAt = now;
        history.push(1 / delta);
        if (history.length > this.length) history.shift();
        this.#fps = Math.round(history.reduce((a, b) => a + b) / this.length);
    }

    get lastUpdateAt () { return this.#lastUpdateAt }
    get fps () { return this.#fps }
    get length () { return this.#historyLength }
    set length (number) { return (this.#historyLength = number) }
}

// everything this is in milliseconds
export class Interval {
    #interval;
    #lastInterval = performance.now();
    #lastDelta = performance.now();
    // milliseconds
    constructor (interval) { this.#interval = interval }

    #delta (time) { return time - this.#lastInterval }

    freeze () { this.#lastInterval = performance.now() - this.interval }

    get interval () { return this.#interval }
    get delta () { return performance.now() - this.#lastInterval }
    get lastDelta () { return this.#lastDelta } // delta value just before ready was called
    // check and set
    get ready () {
        const now = performance.now();
        const delta = this.#delta(now);
        if (delta >= this.#interval) { // access directly for speed
            this.#lastInterval = now;
            this.#lastDelta = delta;
            return true;
        }
        return false;
    }
}

// virtual coordinate space viewport window
class Viewbox extends BoundingBox {
    #canvas;
    #states = new Array();
    constructor (appCanvas, size) {
        super(undefined, new Vector(1, 1));
        if (!appCanvas?.isAppCanvas) throw new Error(`[${this.constructor.name}]: canvas must be of type AppCanvas, got ${typeof appCanvas}`);
        this.#canvas = appCanvas;
        this.max.apply(appCanvas.planeSize);
        if (size) this.applySize(size);
    }

    save () { this.#states.push({min: this.min.clone(), max: this.max.clone()}) }
    restore () {
        if (this.#states.length) {
            const { min, max } = this.#states.pop();
            this.max.apply(max);
            this.min.apply(min);
        }
    }
    getPosition () { return super.center }
    setPosition (point) {
        const { planeSize } = this.#canvas;
        const { size } = this;
        const targetMin = point.sub(size.div(2));
        const limit = planeSize.sub(size);
        const minX = Math.max(0, Math.min(targetMin.x, limit.x));
        const minY = Math.max(0, targetMin.y);
        this.max.apply(this.min.apply(minX, minY)).add(size, true);
        return this; // for chaining
    }
    applySize (size) {
        const scale = size.div(this.size);
        return this.applyScale(scale);
    }
    applyScale (scale) {
        const { planeSize } = this.#canvas;
        const offset = this.center.clone();
        const min = this.min.sub(offset, false).mul(scale, true).add(offset, true);
        const max = this.max.sub(offset, false).mul(scale, true).add(offset, true);
        const size = max.sub(min).abs(true);
        const aspect = size.quot();
        if (!this.#canvas.isPortrait && size.x > planeSize.x) size.apply(planeSize.x, planeSize.x / aspect);
        if (!this.#canvas.isLandscape && size.y > planeSize.y) size.apply(planeSize.y * aspect, planeSize.y);
        if (this.size.eq(size)) return this;
        const limit = planeSize.sub(size);
        const minX = Math.max(0, Math.min(min.x, limit.x));
        const minY = Math.max(0, Math.min(min.y, limit.y));
        this.max.apply(this.min.apply(minX, minY)).add(size, true);
        return this; // for chaining
    }
    // sets cursor origin and scale to match viewbox
    setCursor (cursor, save = false) {
        if (save) cursor.save();
        cursor.scale(this.canvasScale);
        cursor.ctx.translate(-this.min.x, -cursor.normalizeY(this.max.y));
    }
    setCanvas (save = false) {
        this.setCursor(this.#canvas.cursor, save);
    }
    toRelative (point, mutate = false) {
        const pt = mutate ? point : point.clone();
        return pt.sub(this.min, true)
            .mul(this.canvasScale, true);
    }
    toGlobal (point, mutate = false) {
        const pt = mutate ? point : point.clone();
        return pt.div(this.canvasScale, true)
            .add(this.min, true);
    }

    get isViewbox () { return true }
    get canvasScale () { return this.#canvas.size.div(this.size) }
    get isOnEdge () {
        const { planeSize } = this.#canvas;
        return this.min.x <= 0
            || this.min.y <= 0
            || this.max.x >= planeSize.x
            || this.max.y >= planeSize.y;
    }
    get aspectRatio () { return this.size.quot() }
    // preserves height
    // [!] inefficient
    set aspectRatio (ratio) {
        this.applySize(new Vector(this.height * ratio, this.height));
        return ratio;
    }
}

export class ViewboxController {
    static SNAP_THRESHOLD = 0.1**2;
    #states = new Array();
    #targets = new Set();
    #follows = new Set();
    #targetSize = new Vector();
    #lerpFactor = 1;
    #Viewbox;
    #tempBox = new BoundingBox(); // temp storage for computing boundBox
    #setBoundBox = true;
    #boundBox = new BoundingBox(); // boundingBox that fits all targets (may be larger than allowed by Viewbox)
    #focus = false; // when set, Viewbox will be shrunk to strictly fit targets. otherwise Viewbox will only grow to fit targets
    #isLerping = {
        size: false,
        center: false
    };
    #keepSize = true;
    enabled = true;
    constructor (viewbox) {
        if (!viewbox?.isViewbox) throw new Error(`[${this.constructor.name}]: Invalid parameter - expected Viewbox, got ${typeof viewbox}`);
        this.#Viewbox = viewbox;
    }

    #computeBoundFn = (target) => {
        if (!this.#getBounds(target)) return;
        if (this.#setBoundBox) {
            this.#boundBox.apply(this.#tempBox.min, this.#tempBox.max);
            this.#setBoundBox = false;
        } else {
            this.#boundBox.add(this.#tempBox, true);
        }
    }
    #cacheBox (minX, minY, maxX, maxY) {
        const cache = this.#tempBox;
        cache.min.x = minX;
        cache.min.y = minY;
        cache.max.x = maxX;
        cache.max.y = maxY;
        return cache; // for chaining
    }
    // returns true if cached, false otherwise
    #getBounds (target) {
        if (target?.isVector) {
            this.#cacheBox(target.x, target.y, target.x, target.y);
        } else if (target?.isBoundingBox) {
            this.#cacheBox(target.min.x, target.min.y, target.max.x, target.max.y);
        } else if (target?.isShape) {
            this.#getBounds(target.getBoundingBox());
        } else {
            return false;
        }
        return true;
    }
    #computeBounds () {
        if (this.isTracking) {
            this.#setBoundBox = true;
            this.#targets.forEach(this.#computeBoundFn);
            this.#follows.forEach(this.#computeBoundFn);
        }
         if (this.isSizeSet) {
            const pad = this.#targetSize
                .sub(this.#boundBox.size)
            pad.x = pad.x > 0 ? pad.x / 2 : 0;
            pad.y = pad.y > 0 ? pad.y / 2 : 0;
            if (pad.x || pad.y) {
                this.#boundBox.min.sub(pad, true);
                this.#boundBox.max.add(pad, true);
            }
        }
    }
    // converts target size to size that preserves viewbox aspect ratio
    // should be called after #computeBounds()
    #computeSize () {
        const { size } = this.#boundBox;
        const targetSize = new Vector(
            Math.max(1, size.x),
            Math.max(1, size.y)
        );
        const viewAspect = this.#Viewbox.aspectRatio;
        if (targetSize.quot() > viewAspect) {
            targetSize.y = targetSize.x / viewAspect;
        } else {
            targetSize.x = targetSize.y * viewAspect;
        }
        return targetSize;
    }

    save () {
        this.#states.push({
            targets: new Set(this.#targets),
            follows: new Set(this.#follows),
            lerp: this.#lerpFactor,
            lerpingSize: this.#isLerping.size,
            lerpingCenter: this.#isLerping.center,
            keepSize: this.#keepSize,
            tSize: this.#targetSize,
            setBbox: this.#setBoundBox,
            bbox: this.#boundBox.clone(),
            tbbox: this.#tempBox.clone(),
            focus: this.#focus,
            enabled: this.enabled
        });
    }
    restore () {
        if (!this.#states.length) return;
        const { targets, follows, lerp, lerpingSize, lerpingCenter, keepSize, tSize, setBbox, bbox, tbbox, focus, enabled } = this.#states.pop();
        this.#targets.clear();
        targets.forEach((t) => this.#targets.add(t));
        this.#follows.clear();
        follows.forEach((t) => this.#follows.add(t));
        this.#lerpFactor = lerp;
        this.#isLerping.size = lerpingSize;
        this.#isLerping.center = lerpingCenter;
        this.#keepSize = keepSize;
        this.#targetSize.apply(tSize);
        this.#setBoundBox = setBbox;
        this.#boundBox.apply(bbox);
        this.#tempBox.apply(tbbox);
        this.#focus = focus;
        this.enabled = enabled;
    }
    update () {
        if (!this.enabled) return;
        this.#computeBounds();
        const { SNAP_THRESHOLD } = this.constructor;
        const size = this.#computeSize();
        const center = this.#boundBox.center;
        const vSize = this.#Viewbox.size;
        const vCenter = this.#Viewbox.center;
        if (!this.#focus
            && this.isTracking
            && (vSize.x > size.x
                || vSize.y > size.y))
            size.apply(vSize);
        const targetSize = this.#lerpFactor >= 1
            ? size : vSize.sub(size).dot() < SNAP_THRESHOLD
                ? size : vSize.lerp(size, this.#lerpFactor, true);
        const targetCenter = this.#lerpFactor >= 1
            ? center : vCenter.sub(center).dot() < SNAP_THRESHOLD
                ? center : vCenter.lerp(center, this.#lerpFactor, true);
        this.#isLerping.size = (this.isSizeSet || this.isTracking) && targetSize.sub(size).dot() >= SNAP_THRESHOLD;
        this.#isLerping.center = this.isTracking && targetCenter.distance(center).lengthSquared >= SNAP_THRESHOLD;
        if (!this.isCentering && this.#follows.size > 0) this.unfollowAll();
        if (this.isSizeSet && !this.isSizing && !this.#keepSize) this.setTargetSize();
        if (this.isTracking) {
            this.#Viewbox.applySize(targetSize);
            this.#Viewbox.setPosition(targetCenter);
        } else if (this.isSizeSet) {
            this.#Viewbox.applySize(targetSize);
        }
        
    }
    track (...targets) {
        for (let i = 0; i < targets.length; i++) {
            const target = targets[i];
            if (target) this.#targets.add(target);
        }
    }
    untrack (...targets) {
        for (let i = 0; i < targets.length; i++) {
            const target = targets[i];
            if (target) this.#targets.delete(target);
        }
    }
    untrackAll () { this.#targets.clear() }
    tracking (target) { return this.#targets.has(target) }
    // tracks targets, untracks when lerping is finished
    follow (...targets) {
        for (let i = 0; i < targets.length; i++) {
            const target = targets[i];
            if (target) this.#follows.add(target);
        }
    }
    unfollow (...targets) {
        for (let i = 0; i < targets.length; i++) {
            const target = targets[i];
            if (target) this.#follows.delete(target);
        }
    }
    unfollowAll () { this.#follows.clear() }
    following (target) { return this.#follows.has(target) }
    setTargetSize(width = 0, height = 0, keep = true) {
        this.#targetSize.apply(width, height);
        this.#keepSize = keep;
        return this;
    }
    getTargetSize () { return this.#targetSize.clone() }

    get isViewboxController () { return true }
    get Viewbox () { return this.#Viewbox }
    get isTracking () { return this.#targets.size > 0 || this.#follows.size > 0}
    get isSizeSet () { return this.#targetSize.x > 0 || this.#targetSize.y > 0 }
    get isSizing () { return this.#isLerping.size }
    get isCentering () { return this.#isLerping.center }
    get targets () { return this.#targets.size + this.#follows.size }
    get focus () { return this.#focus }
    set focus (bool) { return (this.#focus = bool) }
    get lerpFactor () { return this.#lerpFactor }
    set lerpFactor (value) { return (this.#lerpFactor = clamp(value, 0, 1)) }
}

export class AppCanvas {
    #cursor;
    #window;
    #ratio = 1;
    #Viewbox;
    #bbox = new BoundingBox();
    #size = new Vector();
    #resizeCallbacks = new Set();
    #center = new Vector();
    #planeSize = new Vector();
    // planeSize is the true size of the global coorindates
    constructor (canvas, window, planeSize) {
        this.canvas = canvas;
        this.planeSize.apply(planeSize);
        this.#Viewbox = new Viewbox(this);
        this.#window = window;
        this.window.addEventListener("resize", this.#onResize);
        this.#computeLayout();
        this.#cursor = Canvas2DContextCursorFactory(this.canvas, this.planeSize);
    }

    #onResize = () => {
        this.#computeLayout();
        for (const callback of this.#resizeCallbacks)
            callback?.(this);
    }
    #computeLayout () {
        const width = this.window.innerWidth;
        const height = this.window.innerHeight;
        this.canvas.width = width;
        this.canvas.height = height;
        this.size.apply(width, height);
        this.center.apply(this.size.div(2));
        this.#bbox.apply(undefined, this.size);
        this.#ratio = this.size.quot();
        this.Viewbox.aspectRatio = this.aspectRatio;
    }

    getBoundingBox () {
        return this.#bbox;
    }
    removeResizeListener (handler) {
        this.#resizeCallbacks.delete(handler);
    }
    addResizeListener (handler) {
        this.#resizeCallbacks.add(handler);
    }

    get isAppCanvas () { return true }
    get Viewbox () { return this.#Viewbox }
    get planeSize () { return this.#planeSize }
    get cursor () { return this.#cursor }
    get size () { return this.#size }
    get planeScale () { return this.size.div(this.planeSize) }
    get aspectRatio () { return this.#ratio }
    get center () { return this.#center }
    get window () { return this.#window }
    get isPortrait () { return this.#size.x < this.#size .y }
    get isLandscape () { return this.#size.y < this.#size.x }
}

// Transforms world coorindates to canvas drawing coordinates. May be redundant / excessive
// Also accepts Vectors in place of x, y arguments for methods it overloads
class Canvas2DContextCursor {
    #ctx;
    #size;
    #states = new Array();
    fixed = false;
    constructor(canvasContext, size) {
        this.#ctx = canvasContext;
        this.#size = size; // bind reference
    }

    normalizeY (y) {
        return this.fixed
            ? this.#ctx.canvas.height - y
            : this.#size.y - y;
    }
    save () {
        const state = {fixed: this.fixed};
        this.#states.push(state);
        this.#ctx.save();
    }
    restore () { 
        const state = this.#states.pop();
        if (state) {
            this.fixed = state.fixed;
        }
        this.#ctx.restore();
    }
    screenshot (promise = true) {
        if (promise) { // this is more efficient than synchronous method
            return createImageBitmap(this.#ctx.canvas);
        } else {
            const offscreen = new OffscreenCanvas(this.#ctx.canvas.width, this.#ctx.canvas.height);
            const ctx = offscreen.getContext("2d");
            ctx.drawImage(this.#ctx.canvas, 0, 0);
            return offscreen.transferToImageBitmap(); 
        }
    }
    clear () {
        this.#ctx.clearRect(0, 0, this.#ctx.canvas.width, this.#ctx.canvas.height);
    }
    translate (x, y = null) {
        x?.isVector
            ? this.#ctx.translate(x.x, -x.y)
            : this.#ctx.translate(x, -y);
    }
    scale (x, y = null) {
        x?.isVector
            ? this.#ctx.scale(x.x, x.y)
            : this.#ctx.scale(x, y);
    }
    moveTo (x, y = null) {
        x?.isVector
            ? this.#ctx.moveTo(x.x, this.normalizeY(x.y))
            : this.#ctx.moveTo(x, this.normalizeY(y));
    }
    lineTo (x, y = null) {
        x?.isVector
            ? this.#ctx.lineTo(x.x, this.normalizeY(x.y))
            : this.#ctx.lineTo(x, this.normalizeY(y));
    }
    fillRect (x, y, ...args) {
        x?.isVector
            ? this.#ctx.fillRect(x.x, this.normalizeY(x.y), y, ...args)
            : this.#ctx.fillRect(x, this.normalizeY(y), ...args);
    }
    arc (x, y = null, ...args) {
        x?.isVector
            ? (y === null)
                ? this.#ctx.arc(x.x, this.normalizeY(x.y), ...args)
                : this.#ctx.arc(x.x, this.normalizeY(x.y), y, ...args)
            : this.#ctx.arc(x, this.normalizeY(y), ...args);
    }
    ellipse (x, y, ...args) {
        x?.isVector
            ? this.#ctx.ellipse(x.x, this.normalizeY(x.y), y, ...args)
            : this.#ctx.ellipse(x, this.normalizeY(y), ...args);
    }
    strokeText (text, x, y = null, ...args) {
        x?.isVector
            ? (y === null)
                ? this.#ctx.strokeText(text, x.x, this.normalizeY(x.y), ...args)
                : this.#ctx.strokeText(text, x.x, this.normalizeY(x.y), y, ...args)
            : this.#ctx.strokeText(text, x, this.normalizeY(y), ...args);
    }
    fillText (text, x, y = null, ...args) {
        x?.isVector
            ? (y === null)
                ? this.#ctx.fillText(text, x.x, this.normalizeY(x.y), ...args)
                : this.#ctx.fillText(text, x.x, this.normalizeY(x.y), y, ...args)
            : this.#ctx.fillText(text, x, this.normalizeY(y), ...args);
    }
    drawImage (image, ...args) { // only override / normalize Y when given vector parameters
        if (args.length === 1 && args[0]?.isVector) { // drawImage(image, dVector)
            const [dXY] = args;
            this.#ctx.drawImage(image, dXY.x, this.normalizeY(dXY.y));
        } else if (args.length === 2 && args[0]?.isVector && args[1]?.isVector) { // drawImage(image, Vector<dx, dy>, Vector<dWidth, dHeight>)
            const [dXY, dWH] = args;
            this.#ctx.drawImage(image, dXY.x, this.normalizeY(dXY.y), dWH.x, dWH.y);
        } else if (args.length === 4 && args[0]?.isVector && args[1]?.isVector && args[2]?.isVector && args[3]?.isVector) { // drawImage(image, Vector<sx, sy>, Vector<sWidth, sHeight>, Vector<dx, dy>, Vector<dWidth, dHeight>)
            const [sXY, sWH, dXY, dWH] = args;
            this.#ctx.drawImage(image, sXY.x, sXY.y, sWH.x, sWH.y, dXY.x, this.normalizeY(dXY.y), dWH.x, dWH.y);
        } else {
            this.#ctx.drawImage(image, ...args);
        }
    }
    get ctx () {
        return this.#ctx;
    }
    get isCanvasCursor () {
        return true;
    }
    get hash () {
        // pixels should be a Uint8ClampedArray
        const pixels = this.#ctx.getImageData(0, 0, this.#size.x, this.#size.y)?.data;
        let hash = 0;
        for (const val of pixels)
            hash = (hash * 31 + val) | 0; // 32-bit range
        return hash >>> 0;
    }
    get filterSupported () { return "filter" in this.#ctx }
    get blurSupported () {
        this.#ctx.save();
        if (!this.filterSupported) return false;
        const testFilter = "blur(10px)";
        this.#ctx.filter = testFilter;
        const supported = this.#ctx.filter === testFilter;
        this.#ctx.restore();
        return supported;
    }
}

// DefaultDict implementation
export function Canvas2DContextCursorFactory (canvas, size, viewboxFn = undefined) {
    const cursor = new Canvas2DContextCursor(canvas.getContext("2d"), size, viewboxFn);
    return new Proxy(cursor, {
        get (target, prop, receiver) {
            const obj = (prop in target) ? target : target.ctx;
            const value = Reflect.get(obj, prop, obj);
            if (typeof value === "function")
                return value.bind(obj);
            return value;
        },
        set (target, prop, value, receiver) {
            return (prop in target)
                ? Reflect.set(target, prop, value, receiver)
                : Reflect.set(target.ctx, prop, value, target.ctx);
        }
    });
}
