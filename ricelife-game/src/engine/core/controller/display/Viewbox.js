import { BoundingBox } from "../../geometry/BoundingBox.js";
import { Vector } from "../../math/Vector.js";
import { typeString } from "../../utils/logging.js";
import { equals } from "../../math/utils.js";

// virtual coordinate space viewport window
export class Viewbox extends BoundingBox {
    static ASPECT_RATIO_TOLERANCE = 0.0001;
    #canvas;
    #planeSize = new Vector();
    #states = new Array();
    #bounding = { // used to clamp movement to plane
        top: true,
        left: true,
        bottom: true,
        right: true
    };
    constructor (appCanvas, planeSize = undefined, size = undefined) {
        super(undefined, new Vector(1, 1));
        if (!appCanvas?.isAppCanvas) throw new Error(`[${typeString(this)}]: canvas must be of type AppCanvas, got ${typeString(appCanvas)}`);
        this.#canvas = appCanvas;
        if (planeSize) {
            this.max.apply(planeSize);
            this.planeSize.apply(planeSize);
        }
        if (size) this.applySize(size);
    }

    #boundYAxis (size, min, maxSize) {
        const { bounding, planeSize } = this;
        let lock = false;
        if (bounding.top && bounding.bottom) {
            if (size.y > planeSize.y) {
                size.y = maxSize.y;
                lock = true;
            }
            if (min.y < 0) {
                min.y = 0;
            } else if (min.y + size.y > planeSize.y) {
                min.y = planeSize.y - size.y;
            }
        } else if (bounding.top) {
            min.y = Math.min(0, min.y);
        } else if (bounding.bottom) {
            min.y = Math.max(0, min.y);
        }
        return lock;
    }
    #boundXAxis (size, min, maxSize) {
        const { bounding, planeSize } = this;
        let lock = false;
        if (bounding.left && bounding.right) {
            if (size.x > planeSize.x) {
                size.x = maxSize.x;
                lock = true;
            }
            if (min.x < 0) {
                min.x = 0;
            } else if (min.x + size.x > planeSize.x) {
                min.x = planeSize.x - size.x;
            }
        } else if (bounding.right) {
            min.x = Math.min(0, min.x);
        } else if (bounding.left) {
            min.x = Math.max(0, min.x);
        }
        return lock;
    }
    #setClampedSize (size, min) {
        if (this.planeSize.lengthSquared) {
            const maxSize = this.#applyAspectRatio(this.planeSize.clone()).floor(true);
            const { bounding, planeSize } = this;
            const { isPortrait, aspectRatio } = this.#canvas;
            if (isPortrait) {
                if (this.#boundYAxis(size, min, maxSize)) {
                    size.x = size.y * aspectRatio;
                    min.x = min.y * aspectRatio;
                } else
                    this.#boundXAxis(size, min, maxSize);
            } else {
                if (this.#boundXAxis(size, min, maxSize)) {
                    size.y = size.x / aspectRatio;
                    min.y = min.x / aspectRatio;
                } else
                    this.#boundYAxis(size, min, maxSize);
            }
        }
        this.max.apply(this.min.apply(min)).add(size, true);
    }
    #applyAspectRatio (size) {
        const { aspectRatio } = this.#canvas;
        if (!equals(size.quot(), aspectRatio, Viewbox.ASPECT_RATIO_TOLERANCE)) {
            size.y = size.x / aspectRatio;
        }
        return size;
    }

    save () { this.#states.push(this.getState()) }
    getState () {
        return {
            min: this.min.clone(),
            max: this.max.clone(),
            plane: this.planeSize.clone()
        };
    }
    restore () {
        if (this.#states.length)
            this.setState(this.#states.pop());
    }
    setState (state) {
        const { min, max, plane } = state;
        this.max.apply(max);
        this.min.apply(min);
        this.planeSize.apply(plane);
    }
    getPosition () { return super.center }
    setPosition (point) {
        const { planeSize } = this;
        const size = this.#applyAspectRatio(this.size);
        const min = point.sub(size.div(2));
        this.#setClampedSize(size, min);
        return this; // for chaining
    }
    applySize (size) {
        const scale = size.div(this.size);
        return this.applyScale(scale);
    }
    applyScale (scale) {
        const { planeSize } = this;
        const offset = this.center.clone();
        const min = this.min.sub(offset).mul(scale, true).add(offset, true);
        const max = this.max.sub(offset).mul(scale, true).add(offset, true);
        const size = this.#applyAspectRatio(max.sub(min).abs(true));
        if (this.size.eq(size)) return this;

        const correctedMin = this.size.sub(size, true).div(2, true).add(this.min, true);
        this.#setClampedSize(size, correctedMin);
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
    // expects bounding box
    setPlane (plane, applySize = false) {
        const { size } = plane;
        this.planeSize.apply(size);
        if (applySize) this.applySize(size);
    }

    get isViewbox () { return true }
    get canvasScale () { return this.#canvas.size.div(this.size) }
    get planeSize () { return this.#planeSize }
    get bounding () { return this.#bounding }
    get isOnEdge () {
        const { planeSize } = this;
        return this.min.x <= 0
            || this.min.y <= 0
            || this.max.x >= planeSize.x
            || this.max.y >= planeSize.y;
    }
    get aspectRatio () { return this.size.quot() }
    // preserves axis depending on canvas orientation
    set aspectRatio (ratio) {
        const newSize = this.#canvas.isPortrait
            ? new Vector(this.width, this.width / ratio)
            : new Vector(this.height * ratio, this.height);
        this.applyScale(newSize.div(this.size));
        return ratio;
    }
    // [!] mostly for debugging
    get isWarped () { return !equals(this.aspectRatio, this.#canvas.aspectRatio, Viewbox.ASPECT_RATIO_TOLERANCE) }
}
