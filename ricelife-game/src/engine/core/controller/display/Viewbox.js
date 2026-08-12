import { BoundingBox } from "../../geometry/BoundingBox.js";
import { Vector } from "../../math/Vector.js";
import { typeString } from "../../utils/logging.js";

// virtual coordinate space viewport window
export class Viewbox extends BoundingBox {
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

    #clampChange (newSize, newMin) {
        let { x, y } = newMin;
        if (this.planeSize.lengthSquared) {
            const limit = this.planeSize.sub(newSize);
            const maxX = this.bounding.right ? Math.min(x, limit.x) : x;
            const maxY = this.bounding.top ? Math.min(y, limit.y) : y;
            x = this.bounding.left ? Math.max(0, maxX) : maxX;
            y = this.bounding.bottom ? Math.max(0, maxY) : maxY;
        }
        this.max.apply(this.min.apply(x, y)).add(newSize, true);
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
        const { size } = this;
        const min = point.sub(size.div(2));
        this.#clampChange(size, min);
        return this; // for chaining
    }
    applySize (size) {
        const scale = size.div(this.size);
        return this.applyScale(scale);
    }
    applyScale (scale) {
        const { planeSize } = this;
        const offset = this.center.clone(); // Capture the stable core anchor
        const min = this.min.sub(offset).mul(scale, true).add(offset, true);
        const max = this.max.sub(offset).mul(scale, true).add(offset, true);
        const size = max.sub(min).abs(true);

        if (planeSize.lengthSquared) {
            const canvasAspect = this.#canvas.aspectRatio;
            if (size.x > planeSize.x && this.#bounding.left && this.#bounding.right)
                size.apply(planeSize.x, planeSize.x / canvasAspect);
            if (size.y > planeSize.y && this.#bounding.top && this.#bounding.bottom)
                size.apply(planeSize.y * canvasAspect, planeSize.y);
        }
        if (this.size.eq(size)) return this;

        const correctedMin = this.min.add(this.size.sub(size).div(2));
        this.#clampChange(size, correctedMin);
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
    setPlane (plane) {
        const { size } = plane;
        this.planeSize.apply(size);
        if (!this.extent) {
            this.min.apply(0, 0);
            this.max.apply(size);
        }
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
        this.applySize(new Vector(this.height * ratio, this.height));
        return ratio;
    }
}
