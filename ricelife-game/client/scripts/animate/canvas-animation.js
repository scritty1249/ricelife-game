import { Vector } from "../geometry/geometry.js";

export class Animation {
    #position = new Vector();
    #frame = 0;
    #framerateMs = 1000;
    #lastAtTime = 0;
    #frames = [];
    #prevFrame = undefined;
    // framerate in frames per second
    constructor (position, frames, framerate) {
        this.#position.apply(position);
        this.#framerateMs = 1000 / framerate;
        this.#frames = frames;
        this.loop = false;
    }

    draw (cursor) {
        if (this.hasNext) this.next().draw(cursor, this.position);
        else this.#prevFrame.draw(cursor, this.position);
    }
    elapsed () { return performance.now() - this.#lastAtTime }
    next () {
        if (this.ended) return undefined;
        this.#lastAtTime = performance.now();
        this.#prevFrame = this.#frames.at(this.frame++);
        return this.#prevFrame;
    }

    clone () { return new Animation (this.position, this.#frames.clone(), this.#framerateMs * 1000) } // Clones by reference

    get isAnimation () { return true }
    get hasNext () { return this.elapsed() >= this.#framerateMs && !this.ended }
    get ended () { return this.frame >= this.#frames.length  && !this.loop }
    get frame () { return this.#frame }
    set frame (value) { return this.#frame = (this.loop ? value % this.#frames.length : value) }
    get position () { return this.#position }
}

export class AnimationList {
    #animations = [];
    constructor (...animations) {
        this.push(...animations);
    }

    push (...animations) {
        for (const animation of animations) {
            if (!animation?.isAnimation) throw new Error("[AnimationList] Error: Cannot add non-animation of type " + (typeof animation));
            this.#animations.push(animation);
        }        
    }
    update (cursor) {
        const animations = this.#animations.filter((ani) => !ani.ended);
        this.#animations.splice(0, this.length);
        this.#animations.push(...animations);
        this.#animations.forEach((ani) => ani.draw(cursor));
    }

    get length () { return this.#animations.length }
}