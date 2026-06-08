import { Vector } from "../geometry/geometry.js";

export class Animation {
    #position = new Vector();
    #frame = 0;
    #framerateMs = 1000;
    #lastAtTime = 0;
    #frames = [];
    #prevFrame = undefined;
    #promise = {
        promise: undefined,
        resolve: undefined,
        reject: undefined
    };
    loop = false;
    paused = false;
    speed = 1;
    // framerate in frames per second
    constructor (position, frames, framerate) {
        this.#position.apply(position);
        this.#framerateMs = 1000 / framerate;
        this.#frames = frames;
        this.#newPromise();
    }

    #newPromise () {
        const { promise: oldPromise, resolve: oldResolve, reject: oldReject } = this.#promise;
        ({ promise: this.#promise.promise, resolve: this.#promise.resolve, reject: this.#promise.reject } = Promise.withResolvers());
        // maintain previous promises
        if (oldPromise !== undefined) // assume all are populated if promise exists
            this.#promise.promise
                .then((e) => oldResolve(e))
                .catch((e) => oldReject(e));
    }

    draw (cursor) {
        if (this.hasNext) this.next().draw(cursor, this.position);
        else if (this.#prevFrame) this.#prevFrame.draw(cursor, this.position);
    }
    elapsed () { return performance.now() - this.#lastAtTime }
    next () {
        if (this.ended) return undefined;
        if (this.paused) return this.#prevFrame;
        this.#lastAtTime = performance.now();
        this.#prevFrame = this.#frames.at(this.frame++);
        return this.#prevFrame;
    }
    play () {
        this.paused = false;
        return this; // for chaining
    }
    pause () {
        this.paused = true;
        return this; // for chaining
    }
    clone () { // Clones by reference
        const ani = new Animation (this.position, this.#frames.clone(), this.#framerateMs * 1000);
        ani.speed = this.speed;
        ani.paused = this.paused;
    }

    get isAnimation () { return true }
    get hasNext () { return this.elapsed() >= this.#framerateMs / this.speed && !this.ended && !this.paused }
    get ended () {
        const result = this.frame >= this.#frames.length  && !this.loop;
        if (result)
            this.#promise.resolve(); // [!] might cause bloat by repeatedly resolving an already resolved Promise
        return result;
    }
    get onend () { return this.#promise.promise }
    get frame () { return this.#frame }
    get progress () { return this.#frame / this.#frames.length }
    set frame (value) { return this.#frame = (this.loop ? value % this.#frames.length : value) }
    get position () { return this.#position }
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
    get length () { return this.#animations.length }
    get onend () { return Promise.all(this.#animations.map((ani) => ani.onend)) }
    get ended () { return this.#animations.every((ani) => ani.ended) }
}