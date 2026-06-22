import { Vector, Transformation } from "../geometry/geometry.js";

export class Animation {
    #position = new Vector();
    #frame = 0;
    #framerateMs = 1000;
    #lastAtTime = 0;
    #frames = [];
    #prevFrame = undefined;
    #promise = {
        onend: {},
        onstart: {} // resolves when played and delay has passed
    };
    #paused = true;
    loop = false;
    speed = 1;
    delay = 0; // milliseconds, and is affected by speed
    // framerate in frames per second
    constructor (position, frames, framerate) {
        this.#position.apply(position);
        this.#framerateMs = 1000 / framerate;
        this.#frames = frames;
        this.#newPromise(this.#promise.onend);
        this.#newPromise(this.#promise.onstart);
    }

    #newPromise (container) {
        const { promise: oldPromise, resolve: oldResolve, reject: oldReject } = container;
        ({ promise: container.promise, resolve: container.resolve, reject: container.reject } = Promise.withResolvers());
        container.isResolved = false;
        container.promise
            .finally(() => container.isResolved = true);
        // maintain previous promises
        if (oldPromise !== undefined) // assume all are populated if promise exists
            container.promise
                .then((e) => oldResolve(e))
                .catch((e) => oldReject(e));
    }

    draw (cursor) {
        if (this.hasNext) {
            this.next()?.draw(cursor, this.position);
            if (!this.#promise.onstart.isResolved) this.#promise.onstart.resolve();
        } else if (this.#prevFrame) this.#prevFrame.draw(cursor, this.position);
    }
    intervalElapsed () { return performance.now() - this.#lastAtTime }
    next () {
        if (this.ended) return undefined;
        if (this.#paused) return this.#prevFrame;
        this.#lastAtTime = performance.now();
        this.#prevFrame = this.#frames.at(this.frame++);
        return this.#prevFrame;
    }
    play () {
        if (this.#frame === 0)
            this.#lastAtTime = performance.now() + this.delay;
        this.#paused = false;
        return this; // for chaining
    }
    pause () {
        this.#paused = true;
        return this; // for chaining
    }
    clone () { // Clones by reference
        const ani = new Animation (this.position, this.#frames.clone(), this.#framerateMs * 1000);
        ani.speed = this.speed;
        if (this.playing) ani.play();
        return ani;
    }

    get isAnimation () { return true }
    get hasNext () { return this.intervalElapsed() >= this.#framerateMs / this.speed && !this.ended && !this.#paused }
    get ended () {
        const result = this.frame >= this.#frames.length  && !this.loop;
        if (result && !this.#promise.onend.isResolved) this.#promise.onend.resolve();
        return result;
    }
    get playing () { return !this.#paused }
    get onend () { return this.#promise.onend.promise }
    get onstart () { return this.#promise.onstart.promise }
    get frame () { return this.#frame }
    get progress () { return this.#frame / this.#frames.length }
    set frame (value) { return this.#frame = (this.loop ? value % this.#frames.length : value) }
    get duration () { return this.#framerateMs * this.#frames.length } // milliseconds
    get elapsed () { return this.progress * this.duration } // milliseconds
    get position () { return this.#position }
}

// Animation, but for Shapes
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

export class AnimationList {
    #animations = new Array();
    constructor (...animations) {
        this.push(...animations);
    }

    push (...animations) {
        for (const animation of animations) {
            if (animation?.isAnimationList) this.push(...animation);
            else if (!animation?.isAnimation) throw new Error(`[${this.constructor.name}] Error: Cannot add non-animation of type ${typeof animation}`);
            else this.#animations.push(animation);
        }        
    }
    update (cursor) {
        const animations = this.#animations.filter((ani) => !ani.ended);
        this.#animations.splice(0, this.length);
        this.#animations.push(...animations);
        this.#animations.forEach((ani) => ani.draw(cursor));
    }
    play () {
        for (const ani of this.#animations)
            ani.play();
        return this;
    }
    pause () {
        for (const ani of this.#animations)
            ani.pause();
        return this;
    }

    *[Symbol.iterator]() {
        yield *this.#animations;
    }

    get isAnimationList () { return true }
    get playing () { return this.#animations.some((ani) => ani.playing) }
    get length () { return this.#animations.length }
    get onend () { return Promise.all(this.#animations.map((ani) => ani.onend)) }
    get ended () { return this.#animations.every((ani) => ani.ended) || !this.length }
}