import { Identifiable } from "../../utils/tracking/Identifiable.js";
import { BoundingBox } from "../../geometry/BoundingBox.js";
import { Vector } from "../../math/Vector.js";
import { Viewbox } from "./Viewbox.js";
import { clamp, equals } from "../../math/utils.js";

// viewbox controller
export class Camera extends Identifiable {
    static SNAP_THRESHOLD = 0.1**2;
    static SCALING_BEHAVIOR = {
        Grow: 0, // grow when necessary to match target size
        Shrink: 1, // shrink when necessary to match target size
        Always: 2, // always try to match target size
    };
    #canvas;
    #states = new Array();
    #targets = new Set();
    #follows = new Set();
    #targetSize = new Vector();
    #lerpFactor = 1;
    #Viewbox;
    #tempBox = new BoundingBox(); // temp storage for computing boundBox
    #setBoundBox = true;
    #boundBox = new BoundingBox(); // boundingBox that fits all targets (may be larger than allowed by Viewbox)
    #isLerping = {
        size: false,
        center: false
    };
    #keepSize = true; // when set, will attempt to maintain the target size after reached. if unset, target size will clear itself once reached.
    scalingBehavior = Camera.SCALING_BEHAVIOR.Grow;
    enabled = true;
    constructor (appCanvas, planeSize = undefined, viewSize = undefined) {
        super();
        this.#canvas = appCanvas;
        this.#Viewbox = new Viewbox(appCanvas, planeSize, viewSize);
        appCanvas.addResizeListener(this.#onResize);
        this.#onResize(appCanvas);
    }

    #onResize = (appCanvas) => {
        this.Viewbox.aspectRatio = appCanvas.aspectRatio;
    }
    #computeBoundFn (target) {
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
        if (target?.isVector && target.isFinite) {
            this.#cacheBox(target.x, target.y, target.x, target.y);
        } else if (target?.isBoundingBox && target.extentSquared) {
            this.#cacheBox(target.min.x, target.min.y, target.max.x, target.max.y);
        } else if (target?.isShape) {
            return this.#getBounds(target.getBoundingBox());
        } else {
            return false;
        }
        return true;
    }
    #computeBounds () {
        if (this.isTracking) {
            this.#setBoundBox = true;
            for (const target of this.#targets) {
                this.#computeBoundFn(target);
            }
            for (const follow of this.#follows) {
                this.#computeBoundFn(follow);
            }
        }
        if (this.isSizeSet) {
            const { Grow, Shrink, Always } = this.constructor.SCALING_BEHAVIOR;
            const pad = this.#targetSize
                .sub(this.#boundBox.size)
                .div(2, true);
            let doPad = false;
            if (this.scalingBehavior === Grow) {
                const xgt = pad.x > 0;
                const ygt = pad.y > 0;
                if (!xgt) pad.x = 0;
                if (!ygt) pad.y = 0;
                doPad = xgt || ygt;
            } else if (this.scalingBehavior === Shrink) {
                pad.mul(-1, true);
                const xlt = pad.x < 0;
                const ylt = pad.y < 0;
                if (!xlt) pad.x = 0;
                if (!ylt) pad.y = 0;
                doPad = xlt || ylt;
            } else if (this.scalingBehavior === Always) {
                doPad = true;
            }
            if (doPad) {
                this.#boundBox.min.sub(pad, true);
                this.#boundBox.max.add(pad, true);
            }
        }
    }
    // converts target size to size that preserves viewbox aspect ratio
    // should be called after #computeBounds()
    #computeTargetSize () {
        const { Grow, Shrink, Always } = this.constructor.SCALING_BEHAVIOR;
        const vSize = this.#Viewbox.size;
        const hasBounds = this.#boundBox.extentSquared !== 0;
        if (!hasBounds) return vSize;
        const tSize = hasBounds ? this.#boundBox.size : vSize;
        const viewAspect = this.#Viewbox.aspectRatio;
        const targetAspect = tSize.quot();
        if (targetAspect > viewAspect) {
            tSize.y = tSize.x / viewAspect;
        } else if (targetAspect < viewAspect) {
            tSize.x = tSize.y * viewAspect;
        }
        return (this.scalingBehavior === Always
            || (
                this.scalingBehavior === Grow
                && (vSize.x < tSize.x || vSize.y < tSize.y)
            ) || (
                this.scalingBehavior === Shrink
                && (vSize.x > tSize.x || vSize.y > tSize.y)
            )) ? tSize : vSize;
    }

    close () {
        this.#canvas.removeResizeListener(this.#onResize);
    }
    save () {
        this.#states.push(this.getState());
    }
    restore () {
        if (!this.#states.length) return;
        this.setState(this.#states.pop());
    }
    getState (includeViewbox = true) {
        return {
            targets: new Set(this.#targets),
            follows: new Set(this.#follows),
            lerp: this.#lerpFactor,
            lerpingSize: this.#isLerping.size,
            scalingBehavior: this.scalingBehavior,
            lerpingCenter: this.#isLerping.center,
            keepSize: this.#keepSize,
            tSize: this.#targetSize.clone(),
            setBbox: this.#setBoundBox,
            bbox: this.#boundBox.clone(),
            tbbox: this.#tempBox.clone(),
            enabled: this.enabled,
            viewbox: includeViewbox ? this.Viewbox.getState() : undefined,
        };
    }
    setState (state) {
        const {
          targets,
          follows,
          lerp,
          lerpingSize,
          lerpingCenter,
          scalingBehavior,
          keepSize,
          tSize,
          setBbox,
          bbox,
          tbbox,
          enabled,
          viewbox,
        } = state;
        this.#targets.clear();
        targets.forEach((t) => this.#targets.add(t));
        this.#follows.clear();
        follows.forEach((t) => this.#follows.add(t));
        this.#lerpFactor = lerp;
        this.#isLerping.size = lerpingSize;
        this.scalingBehavior = scalingBehavior;
        this.#isLerping.center = lerpingCenter;
        this.#keepSize = keepSize;
        this.#targetSize.apply(tSize);
        this.#setBoundBox = setBbox;
        this.#boundBox.apply(bbox);
        this.#tempBox.apply(tbbox);
        this.enabled = enabled;
        if (viewbox) this.Viewbox.setState(viewbox);
    }
    // sets viewbox to position
    // [!] conflicts if target size is set
    setPosition (x = undefined, y = undefined) {
        const { Viewbox } = this;
        const pos = Viewbox.getPosition();
        if (x?.isVector) pos.apply(x);
        else {
            if (Number.isFinite(x)) pos.x = x;
            if (Number.isFinite(y)) pos.y = y;
        }
        Viewbox.setPosition(pos);
        const after = Viewbox.getPosition();
        return !after.eq(pos);
    }
    // moves viewbox (additive)
    // [!] conflicts if target size is set
    offsetPosition (x = undefined, y = undefined) {
        const { Viewbox } = this;
        const pos = Viewbox.getPosition();
        if (x?.isVector) pos.add(x, true);
        else {
            if (Number.isFinite(x)) pos.x += x;
            if (Number.isFinite(y)) pos.y += y;
        }
        Viewbox.setPosition(pos);
        const after = Viewbox.getPosition();
        return !after.eq(pos);
    }
    // moves viewbox by some factor
    // [!] conflicts if target size is set
    lerpPosition (x = undefined, y = undefined, factor = 1) {
        const { Viewbox } = this;
        const pos = Viewbox.getPosition();
        if (x?.isVector) pos.apply(x);
        else {
            if (Number.isFinite(x)) pos.x = x;
            if (Number.isFinite(y)) pos.y = y;
        }
        Viewbox.setPosition(Viewbox.getPosition().lerp(pos, factor, true));
        const after = Viewbox.getPosition();
        return !after.eq(pos);
    }
    // trigger an update without lerp transitions
    jump () {
        const { lerpFactor } = this;
        this.lerpFactor = 1;
        this.update();
        this.lerpFactor = lerpFactor;
    }
    update () {
        if (!this.enabled || !(this.isSizeSet || this.isTracking)) return;
        this.#computeBounds();
        const { SNAP_THRESHOLD, SCALING_BEHAVIOR } = this.constructor;
        const vSize = this.#Viewbox.size;
        const vCenter = this.#Viewbox.center;
        const size = this.#computeTargetSize();
        const center = this.#boundBox.extentSquared > 0 ? this.#boundBox.center : vCenter;

        const targetSize = this.#lerpFactor >= 1
            ? size : vSize.sub(size).dot() < SNAP_THRESHOLD
                ? size : vSize.lerp(size, this.#lerpFactor, true);
        const targetCenter = this.#lerpFactor >= 1
            ? center : vCenter.sub(center).dot() < SNAP_THRESHOLD
                ? center : vCenter.lerp(center, this.#lerpFactor, true);
        if (this.isTracking) {
            this.#Viewbox.applySize(targetSize);
            this.#Viewbox.setPosition(targetCenter);
        } else if (this.isSizeSet) {
            this.#Viewbox.applySize(targetSize);
        }
        this.#isLerping.size = (this.isSizeSet || this.isTracking) && targetSize.sub(size).dot() >= SNAP_THRESHOLD;
        this.#isLerping.center = this.#Viewbox.center.sub(vCenter).dot() >= SNAP_THRESHOLD;
        if (!this.isCentering && this.#follows.size > 0)
            this.unfollowAll();
        if (this.isSizeSet && !this.isSizing && !this.#keepSize)
            this.clearTargetSize();
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
    unlock () {
        this.untrackAll();
        this.unfollowAll();
        this.clearTargetSize();
    }
    unfollowAll () { this.#follows.clear() }
    following (target) { return this.#follows.has(target) }
    setTargetSize (width = 0, height = 0, keep = true) {
        const { planeSize } = this.Viewbox;
        this.#targetSize.apply(Math.min(width, planeSize.x), Math.min(height, planeSize.y));
        this.#keepSize = keep;
        return this;
    }
    clearTargetSize () {
        this.#targetSize.apply(0, 0);
        this.#keepSize = false;
        return this;
    }
    getTargetSize () { return this.#targetSize.clone() }

    get isCamera () { return true }
    get Viewbox () { return this.#Viewbox }
    get isTracking () { return this.#targets.size > 0 || this.#follows.size > 0}
    get isSizeSet () { return this.#targetSize.lengthSquared > 0 }
    get isSizing () { return this.#isLerping.size }
    get isCentering () { return this.#isLerping.center }
    get targets () { return this.#targets.size + this.#follows.size }
    get position () { return this.Viewbox.center }
    get lerpFactor () { return this.#lerpFactor }
    set lerpFactor (value) { return (this.#lerpFactor = clamp(value, 0, 1)) }
}