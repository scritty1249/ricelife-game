import { Animation } from "./Animation.js";

export class ShapeAnimation extends Animation {
    #shape;
    #drawFn; // (cursor, shape, progress) => {}
    #duration; // stored for cloning
    #framerate; // stored for cloning
    // duration in seconds
    constructor (shape, duration, framerate, drawFn = (cursor, shape, progress) => {}) {
        const totalFramesCount = Math.ceil(duration * framerate);
        super(shape.origin, Array.from({length: totalFramesCount}), framerate);
        this.#shape = shape;
        this.#duration = duration;
        this.#drawFn = drawFn?.bind(this);
    }

    draw (cursor) {
        super.draw(cursor);
        if (this.progress > 0) this.#drawFn?.(cursor, this.#shape, this.progress);

    }
    clone () {
        const ani = new ShapeAnimation(this.#shape.clone(), this.#duration, this.#framerate, this.#drawFn);
        ani.speed = this.speed;
        if (this.playing) ani.play();
        return ani;
    }

    get isShapeAnimation () { return true }
    get position () { return this.#shape.origin }
}
